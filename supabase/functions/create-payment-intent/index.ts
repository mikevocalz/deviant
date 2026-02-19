/**
 * Create Payment Intent Edge Function
 *
 * POST /create-payment-intent
 * Body: { event_id, ticket_type_id, quantity, user_id }
 *
 * Returns: { paymentIntent, ephemeralKey, customer, publishableKey }
 *
 * Creates a Stripe PaymentIntent for the native PaymentSheet flow.
 * Also creates/retrieves a Stripe Customer and ephemeral key.
 * Reserves inventory via ticket_holds with 10-min TTL.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
  method = "POST",
): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method !== "GET" ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function stripeGet(endpoint: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

/**
 * Get or create a Stripe Customer for a DVNT user.
 * Uses stripe_customers table as the mapping cache.
 */
async function getOrCreateCustomer(
  supabase: any,
  userId: string,
): Promise<string> {
  // Check cache first
  const { data: existing } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  // Fetch user info for Stripe Customer creation
  const { data: authUser } = await supabase
    .from("user")
    .select("id, name, email")
    .eq("id", userId)
    .single();

  const params: Record<string, string> = {
    "metadata[dvnt_user_id]": userId,
  };
  if (authUser?.email) params.email = authUser.email;
  if (authUser?.name) params.name = authUser.name;

  const customer = await stripeRequest("/customers", params);

  // Cache the mapping
  await supabase.from("stripe_customers").upsert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { event_id, ticket_type_id, quantity = 1, user_id } = await req.json();

    if (!event_id || !ticket_type_id || !user_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // ── Fetch ticket type ────────────────────────────────────
    const { data: ticketType, error: ttError } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", ticket_type_id)
      .single();

    if (ttError || !ticketType) return json({ error: "Ticket type not found" }, 404);

    // ── Check availability (including existing holds) ────────
    const remaining =
      (ticketType.quantity_total || Infinity) - (ticketType.quantity_sold || 0);

    // Count active holds for this ticket type (not expired, not converted)
    const { count: activeHolds } = await supabase
      .from("ticket_holds")
      .select("*", { count: "exact", head: true })
      .eq("ticket_type_id", ticket_type_id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString());

    const effectiveRemaining = remaining - (activeHolds || 0);

    if (quantity > effectiveRemaining) {
      return json({ error: "Not enough tickets available" }, 400);
    }

    // ── Check max per user ───────────────────────────────────
    if (quantity > (ticketType.max_per_user || 4)) {
      return json({
        error: `Maximum ${ticketType.max_per_user || 4} tickets per person`,
      }, 400);
    }

    // ── Free tickets: issue directly ─────────────────────────
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

      await supabase
        .from("ticket_types")
        .update({ quantity_sold: (ticketType.quantity_sold || 0) + quantity })
        .eq("id", ticket_type_id);

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
          { order_id: freeOrder.id, type: "payment_captured", label: "Free ticket issued" },
        ]);
      }

      return json({ tickets: issued, free: true });
    }

    // ── Paid tickets: PaymentIntent flow ─────────────────────

    // Fetch event + organizer
    const { data: event } = await supabase
      .from("events")
      .select("host_id, title")
      .eq("id", parseInt(event_id))
      .single();

    if (!event?.host_id) return json({ error: "Event not found" }, 404);

    const { data: organizer } = await supabase
      .from("organizer_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("host_id", event.host_id)
      .single();

    if (!organizer?.stripe_account_id || !organizer?.charges_enabled) {
      return json({ error: "Organizer has not completed payment setup" }, 400);
    }

    // ── Fee structure (same as ticket-checkout) ──────────────
    const unitPrice = ticketType.price_cents;
    const buyerSurcharge = Math.round(unitPrice * 0.025) + 100;
    const chargePerTicket = unitPrice + buyerSurcharge;
    const totalCents = chargePerTicket * quantity;
    const applicationFee = Math.round(unitPrice * quantity * 0.05) + 200 * quantity;

    // ── Get or create Stripe Customer ────────────────────────
    const customerId = await getOrCreateCustomer(supabase, user_id);

    // ── Create idempotency key ───────────────────────────────
    const idempotencyKey = `pi_${user_id}_${event_id}_${ticket_type_id}_${quantity}_${Date.now()}`;

    // ── Create PaymentIntent ─────────────────────────────────
    const pi = await stripeRequest("/payment_intents", {
      amount: totalCents.toString(),
      currency: ticketType.currency || "usd",
      customer: customerId,
      "automatic_payment_methods[enabled]": "true",
      "transfer_data[destination]": organizer.stripe_account_id,
      application_fee_amount: applicationFee.toString(),
      "metadata[type]": "event_ticket",
      "metadata[event_id]": event_id.toString(),
      "metadata[ticket_type_id]": ticket_type_id,
      "metadata[user_id]": user_id,
      "metadata[quantity]": quantity.toString(),
      "metadata[event_title]": (event.title || "").substring(0, 500),
    });

    // ── Create ephemeral key for PaymentSheet ────────────────
    const ephemeralRes = await fetch("https://api.stripe.com/v1/ephemeral_keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: new URLSearchParams({ customer: customerId }).toString(),
    });
    const ephemeralKey = await ephemeralRes.json();

    // ── Create inventory hold ────────────────────────────────
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    await supabase.from("ticket_holds").insert({
      user_id,
      ticket_type_id,
      event_id: parseInt(event_id),
      quantity,
      payment_intent_id: pi.id,
      status: "active",
      expires_at: holdExpiresAt,
    });

    // ── Create order row in payment_pending state ────────────
    await supabase.from("orders").insert({
      user_id,
      type: "event_ticket",
      status: "payment_pending",
      subtotal_cents: unitPrice * quantity,
      platform_fee_cents: applicationFee,
      total_cents: totalCents,
      event_id: parseInt(event_id),
      stripe_payment_intent_id: pi.id,
    });

    return json({
      paymentIntent: pi.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      paymentIntentId: pi.id,
    });
  } catch (err: any) {
    console.error("[create-payment-intent] Error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
