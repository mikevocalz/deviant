/**
 * Ticket Upgrade Edge Function
 *
 * POST /ticket-upgrade
 * Body: { ticket_id, new_ticket_type_id }
 *
 * Creates a Stripe Checkout Session charging the price DIFFERENCE between
 * the user's current ticket and the requested higher tier.
 *
 * On successful payment, the stripe-webhook marks the old ticket upgraded
 * and issues a new ticket at the higher tier.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySession } from "../_shared/verify-session.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_SCHEME = "dvnt";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

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
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // Verify user session
    const authId = await verifySession(supabase, req);
    if (!authId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { ticket_id, new_ticket_type_id } = await req.json();
    if (!ticket_id || !new_ticket_type_id) {
      return json({ error: "ticket_id and new_ticket_type_id are required" }, 400);
    }

    // Fetch the existing ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, user_id, purchase_amount_cents, status, ticket_type_id")
      .eq("id", ticket_id)
      .single();

    if (ticketErr || !ticket) {
      return json({ error: "Ticket not found" }, 404);
    }

    // Verify ownership — ticket.user_id is the Better Auth userId string
    if (String(ticket.user_id) !== String(authId)) {
      return json({ error: "Not your ticket" }, 403);
    }

    if (ticket.status !== "active") {
      return json({ error: "Only active tickets can be upgraded" }, 400);
    }

    // Fetch new ticket type
    const { data: newType, error: newTypeErr } = await supabase
      .from("ticket_types")
      .select("id, name, price_cents, event_id")
      .eq("id", new_ticket_type_id)
      .single();

    if (newTypeErr || !newType) {
      return json({ error: "Target tier not found" }, 404);
    }

    if (String(newType.event_id) !== String(ticket.event_id)) {
      return json({ error: "Tier belongs to a different event" }, 400);
    }

    const paidCents = ticket.purchase_amount_cents || 0;
    const newPriceCents = newType.price_cents || 0;
    const diffCents = Math.max(0, newPriceCents - paidCents);

    if (diffCents === 0) {
      return json({ error: "New tier must cost more than current tier" }, 400);
    }

    // Fetch event for display name
    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", ticket.event_id)
      .single();

    // Create Stripe Checkout Session for the price difference
    const successUrl = `${APP_SCHEME}://ticket/${ticket.event_id}?upgraded=1`;
    const cancelUrl = `${APP_SCHEME}://ticket/${ticket.event_id}`;

    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(diffCents),
      "line_items[0][price_data][product_data][name]": `Upgrade to ${newType.name}`,
      "line_items[0][price_data][product_data][description]":
        `${event?.title || "Event"} — Upgrade from current ticket`,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[type]": "ticket_upgrade",
      "metadata[ticket_id]": String(ticket_id),
      "metadata[new_ticket_type_id]": String(new_ticket_type_id),
      "metadata[event_id]": String(ticket.event_id),
      "metadata[user_auth_id]": authId,
    });

    return json({ url: session.url, diff_cents: diffCents });
  } catch (err: any) {
    console.error("[ticket-upgrade]", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
