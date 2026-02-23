/**
 * Ticket Checkout Edge Function
 *
 * POST /ticket-checkout
 * Body: { event_id, ticket_type_id, quantity, user_id }
 *
 * Creates a Stripe Checkout Session with:
 *   - Destination charge to connected organizer account
 *   - application_fee_amount = 5% + $1 per ticket (DVNT platform fee)
 *   - Deep link success/cancel URLs
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const {
      event_id,
      ticket_type_id,
      quantity = 1,
      user_id,
    } = await req.json();

    if (!event_id || !ticket_type_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // Fetch ticket type
    const { data: ticketType, error: ttError } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", ticket_type_id)
      .single();

    if (ttError || !ticketType) {
      return new Response(JSON.stringify({ error: "Ticket type not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check availability
    const remaining =
      (ticketType.quantity_total || Infinity) - (ticketType.quantity_sold || 0);
    if (quantity > remaining) {
      return new Response(
        JSON.stringify({ error: "Not enough tickets available" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check max per user
    if (quantity > (ticketType.max_per_user || 4)) {
      return new Response(
        JSON.stringify({
          error: `Maximum ${ticketType.max_per_user || 4} tickets per person`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Free tickets: issue directly without Stripe
    if (ticketType.price_cents === 0) {
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const qrToken = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        tickets.push({
          event_id: parseInt(event_id),
          ticket_type_id,
          user_id,
          status: "active",
          qr_token: qrToken,
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

      // ── Create order row for free ticket ─────────────────
      const { data: freeOrder } = await supabase
        .from("orders")
        .insert({
          user_id,
          type: "event_ticket",
          status: "paid",
          subtotal_cents: 0,
          total_cents: 0,
          event_id: parseInt(event_id),
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (freeOrder?.id) {
        await supabase.from("order_timeline").insert([
          { order_id: freeOrder.id, type: "created", label: "Order created" },
          {
            order_id: freeOrder.id,
            type: "payment_captured",
            label: "Free ticket issued",
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

    // ── Fee structure ──────────────────────────────────────────
    // Customer: 2.5% + $1/ticket  |  Organizer: 2.5% + $1/ticket
    // DVNT total: 5% + $2/ticket (covers Stripe processing + platform fee)
    const unitPrice = ticketType.price_cents;
    const buyerSurcharge = Math.round(unitPrice * 0.025) + 100; // 2.5% + $1
    const chargePerTicket = unitPrice + buyerSurcharge;

    // application_fee = buyer(2.5%+$1) + organizer(2.5%+$1)
    const applicationFee =
      Math.round(unitPrice * quantity * 0.05) + 200 * quantity;

    // Create Stripe Checkout Session with destination charge
    const params: Record<string, string> = {
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": ticketType.currency || "usd",
      "line_items[0][price_data][unit_amount]": chargePerTicket.toString(),
      "line_items[0][price_data][product_data][name]": ticketType.name,
      "line_items[0][quantity]": quantity.toString(),
      "payment_intent_data[application_fee_amount]": applicationFee.toString(),
      "payment_intent_data[transfer_data][destination]":
        organizer.stripe_account_id,
      "metadata[type]": "event_ticket",
      "metadata[event_id]": event_id.toString(),
      "metadata[ticket_type_id]": ticket_type_id,
      "metadata[user_id]": user_id,
      "metadata[quantity]": quantity.toString(),
      success_url: `${APP_SCHEME}://tickets/success?eventId=${event_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_SCHEME}://tickets/cancel?eventId=${event_id}`,
    };

    const session = await stripeRequest("/checkout/sessions", params);

    // ── Create order row in payment_pending state ────────
    const totalCents = chargePerTicket * quantity;
    const platformFeeCents = applicationFee;
    await supabase.from("orders").insert({
      user_id,
      type: "event_ticket",
      status: "payment_pending",
      subtotal_cents: unitPrice * quantity,
      platform_fee_cents: platformFeeCents,
      total_cents: totalCents,
      event_id: parseInt(event_id),
      stripe_checkout_session_id: session.id,
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
