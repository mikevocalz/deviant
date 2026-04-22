/**
 * Ticket Checkout Edge Function
 *
 * POST /ticket-checkout
 * Body:
 *   Authenticated:
 *     { event_id, ticket_type_id, quantity, promo_code? }
 *   Guest:
 *     { event_id, ticket_type_id, quantity, promo_code?,
 *       guest_email, guest_name? }
 *
 * Creates a Stripe Checkout Session with:
 *   - Destination charge to the connected organizer account
 *   - application_fee_amount = 5% + $1 per ticket (DVNT platform fee)
 *   - Deep link success/cancel URLs
 *
 * Guest path: when no Better Auth session is present BUT a valid
 * `guest_email` is supplied, the request is accepted as a guest
 * checkout. The ticket row stores the email (no user_id) and the
 * webhook emails a QR + magic-link to the buyer via Resend.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeFees } from "../_shared/fee-calculator.ts";
import { verifySession } from "../_shared/verify-session.ts";
import { createSignedQrPayload } from "../_shared/hmac-qr.ts";
import {
  validateAndApplyPromo,
  incrementPromoUsage,
} from "../_shared/apply-promo-code.ts";
import { maybeFireCapacityAlerts } from "../_shared/capacity-alerts.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_SCHEME = "dvnt";

async function stripeRequest(
  endpoint: string,
  body: Record<string, string>,
): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    const {
      event_id,
      ticket_type_id,
      quantity = 1,
      promo_code,
      guest_email,
      guest_name,
    } = await req.json();

    // ── Session auth — required UNLESS guest_email is provided ──
    const user_id = await verifySession(supabase, req);
    const trimmedGuestEmail =
      typeof guest_email === "string" ? guest_email.trim().toLowerCase() : "";
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedGuestEmail);
    const isGuest = !user_id && !!trimmedGuestEmail && isValidEmail;

    if (!user_id && !isGuest) {
      return new Response(
        JSON.stringify({
          error: trimmedGuestEmail
            ? "Invalid guest email address"
            : "Unauthorized — sign in or provide a guest email",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const buyerKey = user_id || `guest:${trimmedGuestEmail}`;

    if (!event_id || !ticket_type_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return new Response(JSON.stringify({ error: "Invalid quantity" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch ticket type (scoped to event to prevent cross-event manipulation)
    const { data: ticketType, error: ttError } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", ticket_type_id)
      .eq("event_id", parseInt(event_id))
      .single();

    if (ttError || !ticketType) {
      return new Response(
        JSON.stringify({ error: "Ticket type not found for this event" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check availability (including active holds from other checkouts)
    const remaining =
      (ticketType.quantity_total || Infinity) - (ticketType.quantity_sold || 0);

    const { count: activeHolds } = await supabase
      .from("ticket_holds")
      .select("*", { count: "exact", head: true })
      .eq("ticket_type_id", ticket_type_id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString());

    const effectiveRemaining = remaining - (activeHolds || 0);

    if (quantity > effectiveRemaining) {
      return new Response(
        JSON.stringify({ error: "Not enough tickets available" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check max per user (including already-owned tickets).
    // For guests we count by email; for users we count by user_id.
    const maxPerUser = ticketType.max_per_user || 4;
    let ownedQuery = supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("ticket_type_id", ticket_type_id)
      .in("status", ["active", "scanned", "transfer_pending"]);
    ownedQuery = isGuest
      ? ownedQuery.eq("guest_email", trimmedGuestEmail)
      : ownedQuery.eq("user_id", user_id as string);
    const { count: ownedCount } = await ownedQuery;

    if ((ownedCount || 0) + quantity > maxPerUser) {
      const ticketsRemaining = maxPerUser - (ownedCount || 0);
      return new Response(
        JSON.stringify({
          error:
            ticketsRemaining <= 0
              ? `Already at the maximum ${maxPerUser} tickets for this email`
              : `You can only buy ${ticketsRemaining} more (max ${maxPerUser} per person)`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Promo code validation (before free/paid branching) ────
    let promoResult: any = null;
    let discountCents = 0;
    if (promo_code) {
      const { result, error: promoErr } = await validateAndApplyPromo(
        supabase,
        parseInt(event_id),
        promo_code,
        ticket_type_id,
        ticketType.price_cents * quantity,
      );
      if (promoErr) {
        return new Response(JSON.stringify({ error: promoErr }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      promoResult = result;
      discountCents = promoResult?.discount_cents || 0;
    }

    const rawSubtotal = ticketType.price_cents * quantity;
    const effectiveSubtotal = Math.max(0, rawSubtotal - discountCents);

    // Free tickets (or fully discounted): issue directly without Stripe
    if (effectiveSubtotal === 0) {
      const tickets = [];
      const eventIdInt = parseInt(event_id);
      for (let i = 0; i < quantity; i++) {
        const ticketUuid = crypto.randomUUID();
        const { qrToken, qrPayload } = await createSignedQrPayload(
          ticketUuid,
          eventIdInt,
        );
        tickets.push({
          id: ticketUuid,
          event_id: eventIdInt,
          ticket_type_id,
          user_id: isGuest ? null : user_id,
          guest_email: isGuest ? trimmedGuestEmail : null,
          guest_name: isGuest ? (typeof guest_name === "string" ? guest_name.trim() : null) : null,
          guest_lookup_token: isGuest ? crypto.randomUUID() : null,
          status: "active",
          qr_token: qrToken,
          qr_payload: qrPayload,
          purchase_amount_cents: 0,
        });
      }

      const { data: issued, error: issueError } = await supabase
        .from("tickets")
        .insert(tickets)
        .select("id, qr_token");

      if (issueError) throw issueError;

      // Increment sold count
      await supabase
        .from("ticket_types")
        .update({
          quantity_sold: (ticketType.quantity_sold || 0) + quantity,
        })
        .eq("id", ticket_type_id);

      // Capacity milestone alerts (75 / 90 / 100 %) — idempotent
      await maybeFireCapacityAlerts(supabase, {
        eventId: parseInt(event_id),
        ticketTypeId: ticket_type_id,
      });

      // Increment promo usage if a promo was used
      if (promoResult) {
        await incrementPromoUsage(supabase, promoResult.promo_code_id);
      }

      // ── Create order row for free ticket ─────────────────
      const { data: freeOrder } = await supabase
        .from("orders")
        .insert({
          user_id: isGuest ? null : user_id,
          guest_email: isGuest ? trimmedGuestEmail : null,
          type: "event_ticket",
          status: "paid",
          subtotal_cents: 0,
          total_cents: 0,
          event_id: parseInt(event_id),
          paid_at: new Date().toISOString(),
          ...(promoResult
            ? {
                promo_code_id: promoResult.promo_code_id,
                discount_cents: discountCents,
              }
            : {}),
        })
        .select("id")
        .single();

      if (freeOrder?.id) {
        await supabase.from("order_timeline").insert([
          { order_id: freeOrder.id, type: "created", label: "Order created" },
          {
            order_id: freeOrder.id,
            type: "payment_captured",
            label: promoResult
              ? "Free ticket issued (100% promo discount)"
              : "Free ticket issued",
          },
        ]);
      }

      return new Response(JSON.stringify({ tickets: issued, free: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Paid tickets: create Stripe Checkout Session ─────────
    // Fetch organizer's Stripe account
    const { data: event } = await supabase
      .from("events")
      .select("host_id")
      .eq("id", parseInt(event_id))
      .single();

    if (!event?.host_id) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: organizer } = await supabase
      .from("organizer_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("host_id", event.host_id)
      .single();

    if (!organizer?.stripe_account_id || !organizer?.charges_enabled) {
      return new Response(
        JSON.stringify({
          error: "Organizer has not completed payment setup",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Fee structure (v1_250_1pt) ──────────────────────────────
    const subtotalCents = effectiveSubtotal;
    const fees = computeFees(subtotalCents, quantity);

    const currency = ticketType.currency || "usd";

    // Create Stripe Checkout Session: two transparent line items
    const params: Record<string, string> = {
      mode: "payment",
      "payment_method_types[0]": "card",
      // Line 0: base ticket price
      "line_items[0][price_data][currency]": currency,
      "line_items[0][price_data][unit_amount]":
        ticketType.price_cents.toString(),
      "line_items[0][price_data][product_data][name]": ticketType.name,
      "line_items[0][quantity]": quantity.toString(),
      // Line 1: DVNT buyer service fee (one lump item)
      "line_items[1][price_data][currency]": currency,
      "line_items[1][price_data][unit_amount]": fees.buyer_fee.toString(),
      "line_items[1][price_data][product_data][name]": "DVNT Service Fee",
      "line_items[1][price_data][product_data][description]":
        "2.5% + $1/ticket • Non-refundable",
      "line_items[1][quantity]": "1",
      // Destination charge: DVNT keeps application_fee_amount, rest goes to organizer
      "payment_intent_data[application_fee_amount]":
        fees.application_fee_amount.toString(),
      "payment_intent_data[transfer_data][destination]":
        organizer.stripe_account_id,
      // Fee metadata for webhook reconciliation
      "metadata[type]": "event_ticket",
      "metadata[event_id]": event_id.toString(),
      "metadata[ticket_type_id]": ticket_type_id,
      ...(isGuest
        ? {
            "metadata[guest_email]": trimmedGuestEmail,
            ...(typeof guest_name === "string" && guest_name.trim()
              ? { "metadata[guest_name]": guest_name.trim() }
              : {}),
          }
        : { "metadata[user_id]": user_id as string }),
      "metadata[quantity]": quantity.toString(),
      "metadata[subtotal_cents]": fees.subtotal.toString(),
      "metadata[buyer_fee_cents]": fees.buyer_fee.toString(),
      "metadata[organizer_fee_cents]": fees.organizer_fee.toString(),
      "metadata[dvnt_total_fee_cents]": fees.dvnt_total_fee.toString(),
      "metadata[fee_policy_version]": fees.fee_policy_version,
      ...(promoResult
        ? {
            "metadata[promo_code_id]": promoResult.promo_code_id,
            "metadata[discount_cents]": discountCents.toString(),
            "metadata[promo_code]": promoResult.code,
          }
        : {}),
      // Stripe Tax: automatic collection
      "automatic_tax[enabled]": "true",
      // Pre-fill the buyer's email on the Stripe page when we already
      // have it (guest checkout). Stripe also uses this for the receipt.
      ...(isGuest ? { customer_email: trimmedGuestEmail } : {}),
      success_url: `${APP_SCHEME}://tickets/success?eventId=${event_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_SCHEME}://tickets/cancel?eventId=${event_id}`,
    };

    const session = await stripeRequest("/checkout/sessions", params);

    // ── Create inventory hold (10 min TTL, prevents overselling) ──
    // For guests we still need an "owner" key — use the email so a
    // single buyer can't double-stack holds with the same address.
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from("ticket_holds").insert({
      user_id: isGuest ? null : user_id,
      guest_email: isGuest ? trimmedGuestEmail : null,
      ticket_type_id,
      event_id: parseInt(event_id),
      quantity,
      status: "active",
      expires_at: holdExpiresAt,
      payment_intent_id: session.id,
    });

    // ── Increment promo usage ──
    if (promoResult) {
      await incrementPromoUsage(supabase, promoResult.promo_code_id);
    }

    // ── Create order row in payment_pending state (fee components stored) ──
    await supabase.from("orders").insert({
      user_id,
      type: "event_ticket",
      status: "payment_pending",
      quantity,
      subtotal_cents: fees.subtotal,
      platform_fee_cents: fees.dvnt_total_fee,
      total_cents: fees.customer_charge_amount,
      buyer_pct_fee_cents: fees.buyer_pct_fee,
      buyer_per_ticket_fee_cents: fees.buyer_per_ticket_fee,
      buyer_fee_cents: fees.buyer_fee,
      org_pct_fee_cents: fees.org_pct_fee,
      org_per_ticket_fee_cents: fees.org_per_ticket_fee,
      organizer_fee_cents: fees.organizer_fee,
      dvnt_total_fee_cents: fees.dvnt_total_fee,
      fee_policy_version: fees.fee_policy_version,
      event_id: parseInt(event_id),
      stripe_checkout_session_id: session.id,
      ...(promoResult
        ? {
            promo_code_id: promoResult.promo_code_id,
            discount_cents: discountCents,
          }
        : {}),
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[ticket-checkout] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
