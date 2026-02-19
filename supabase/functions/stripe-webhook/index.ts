/**
 * Stripe Webhook Handler (Edge Function)
 *
 * Handles:
 *   - checkout.session.completed → issue tickets OR grant sneaky access
 *   - charge.refunded → mark ticket refunded
 *   - charge.dispute.created → flag payout on_hold
 *   - account.updated → sync organizer account status
 *
 * IDEMPOTENT: Uses stripe_events table to deduplicate.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computePayoutReleaseAt } from "../_shared/business-days.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Stripe signature verification (manual HMAC for Deno)
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = sigHeader
      .split(",")
      .reduce((acc: Record<string, string>, part: string) => {
        const [k, v] = part.split("=");
        acc[k.trim()] = v;
        return acc;
      }, {});

    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) return false;

    // Tolerance: 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expected === signature;
  } catch (err) {
    console.error("[stripe-webhook] Signature verification error:", err);
    return false;
  }
}

function generateQrToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";

  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(
      body,
      sigHeader,
      STRIPE_WEBHOOK_SECRET,
    );
    if (!valid) {
      console.error("[stripe-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }
  }

  const event = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Idempotency check ──────────────────────────────────────
  const { error: dupeError } = await supabase
    .from("stripe_events")
    .insert({ event_id: event.id, event_type: event.type })
    .single();

  if (dupeError?.code === "23505") {
    console.log("[stripe-webhook] Duplicate event, skipping:", event.id);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[stripe-webhook] Processing:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata || {};

        if (metadata.type === "event_ticket") {
          // ── Issue tickets ────────────────────────────────
          const eventId = parseInt(metadata.event_id);
          const ticketTypeId = metadata.ticket_type_id;
          const userId = metadata.user_id;
          const quantity = parseInt(metadata.quantity) || 1;
          const amountCents = session.amount_total || 0;

          const ticketRows = [];
          for (let i = 0; i < quantity; i++) {
            ticketRows.push({
              event_id: eventId,
              ticket_type_id: ticketTypeId,
              user_id: userId,
              status: "active",
              qr_token: generateQrToken(),
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              purchase_amount_cents: Math.round(amountCents / quantity),
            });
          }

          const { error: ticketError } = await supabase
            .from("tickets")
            .insert(ticketRows);

          if (ticketError) {
            console.error("[stripe-webhook] Ticket insert error:", ticketError);
            throw ticketError;
          }

          // Increment quantity_sold
          const { error: incError } = await supabase.rpc("increment_counter", {
            table_name: "ticket_types",
            column_name: "quantity_sold",
            row_id: ticketTypeId,
            amount: quantity,
          });

          // Fallback if RPC doesn't exist: direct update
          if (incError) {
            const { data: tt } = await supabase
              .from("ticket_types")
              .select("quantity_sold")
              .eq("id", ticketTypeId)
              .single();
            await supabase
              .from("ticket_types")
              .update({ quantity_sold: (tt?.quantity_sold || 0) + quantity })
              .eq("id", ticketTypeId);
          }

          // ── Update order → paid + add timeline ────────
          const { data: orderRow } = await supabase
            .from("orders")
            .select("id")
            .eq("stripe_checkout_session_id", session.id)
            .single();

          if (orderRow) {
            // Get payment method details from charge
            let pmBrand = null;
            let pmLast4 = null;
            if (session.payment_intent) {
              try {
                const piRes = await fetch(
                  `https://api.stripe.com/v1/payment_intents/${session.payment_intent}`,
                  {
                    headers: {
                      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY") || ""}`,
                    },
                  },
                );
                const pi = await piRes.json();
                if (pi.latest_charge) {
                  const chargeRes = await fetch(
                    `https://api.stripe.com/v1/charges/${pi.latest_charge}`,
                    {
                      headers: {
                        Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY") || ""}`,
                      },
                    },
                  );
                  const charge = await chargeRes.json();
                  pmBrand = charge.payment_method_details?.card?.brand || null;
                  pmLast4 = charge.payment_method_details?.card?.last4 || null;
                }
              } catch (e) {
                console.error("[stripe-webhook] PM detail fetch error:", e);
              }
            }

            await supabase
              .from("orders")
              .update({
                status: "paid",
                stripe_payment_intent_id: session.payment_intent,
                payment_method_brand: pmBrand,
                payment_method_last4: pmLast4,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderRow.id);

            await supabase.from("order_timeline").insert([
              {
                order_id: orderRow.id,
                type: "payment_authorized",
                label: "Payment authorized",
              },
              {
                order_id: orderRow.id,
                type: "payment_captured",
                label: "Payment captured",
                detail: `${quantity} ticket(s) issued`,
              },
            ]);
          }

          console.log(
            `[stripe-webhook] Issued ${quantity} tickets for event ${eventId}`,
          );
        } else if (metadata.type === "sneaky_access") {
          // ── Grant sneaky link access ─────────────────────
          const { error: accessError } = await supabase
            .from("sneaky_access")
            .upsert({
              session_id: metadata.session_id,
              user_id: metadata.user_id,
              amount_cents: 299,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
            });

          if (accessError) {
            console.error("[stripe-webhook] Sneaky access error:", accessError);
            throw accessError;
          }
          // Create order for sneaky access purchase
          await supabase.from("orders").insert({
            user_id: metadata.user_id,
            type: "sneaky_access",
            status: "paid",
            subtotal_cents: 299,
            total_cents: 299,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            paid_at: new Date().toISOString(),
          });

          console.log(
            `[stripe-webhook] Granted sneaky access for session ${metadata.session_id}`,
          );
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntent = charge.payment_intent;

        if (paymentIntent) {
          const { error: refundError } = await supabase
            .from("tickets")
            .update({ status: "refunded" })
            .eq("stripe_payment_intent_id", paymentIntent)
            .eq("status", "active");

          if (refundError) {
            console.error("[stripe-webhook] Refund update error:", refundError);
          }

          // Update order status + add timeline
          const { data: refundedOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntent)
            .single();

          if (refundedOrder) {
            const isFullRefund = charge.amount_refunded >= charge.amount;
            await supabase
              .from("orders")
              .update({
                status: isFullRefund ? "refunded" : "partially_refunded",
                refunded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", refundedOrder.id);

            await supabase.from("order_timeline").insert({
              order_id: refundedOrder.id,
              type: "refund_processed",
              label: isFullRefund
                ? "Full refund processed"
                : "Partial refund processed",
              detail: `$${(charge.amount_refunded / 100).toFixed(2)} refunded`,
            });

            // Update any pending refund requests to processed
            await supabase
              .from("refund_requests")
              .update({
                status: "processed",
                resolved_at: new Date().toISOString(),
              })
              .eq("order_id", refundedOrder.id)
              .eq("status", "pending");
          }

          console.log(
            "[stripe-webhook] Refunded tickets for PI:",
            paymentIntent,
          );
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object;
        const paymentIntent = dispute.payment_intent;

        if (paymentIntent) {
          // Find the event via ticket
          const { data: ticket } = await supabase
            .from("tickets")
            .select("event_id")
            .eq("stripe_payment_intent_id", paymentIntent)
            .limit(1)
            .single();

          if (ticket?.event_id) {
            await supabase
              .from("events")
              .update({ payout_status: "on_hold" })
              .eq("id", ticket.event_id);

            // Update order status + add timeline
            const { data: disputedOrder } = await supabase
              .from("orders")
              .select("id")
              .eq("stripe_payment_intent_id", paymentIntent)
              .single();

            if (disputedOrder) {
              await supabase
                .from("orders")
                .update({
                  status: "disputed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", disputedOrder.id);

              await supabase.from("order_timeline").insert({
                order_id: disputedOrder.id,
                type: "dispute_opened",
                label: "Dispute opened",
                detail: `Reason: ${dispute.reason || "unknown"}`,
              });
            }

            console.log(
              "[stripe-webhook] Event payout on_hold due to dispute:",
              ticket.event_id,
            );
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        const { error: accountError } = await supabase
          .from("organizer_accounts")
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", account.id);

        if (accountError) {
          console.error("[stripe-webhook] Account update error:", accountError);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] Processing error:", err);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
