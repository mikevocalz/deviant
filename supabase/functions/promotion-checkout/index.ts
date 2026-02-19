/**
 * Promotion Checkout Edge Function
 *
 * POST /promotion-checkout
 * Body: { event_id, city_id, duration, placement, start_now, organizer_id }
 *
 * Creates a Stripe Checkout Session for event promotion purchase.
 * Payment goes to DVNT (platform revenue), NOT the organizer.
 *
 * On success webhook: creates/activates campaign row idempotently.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_SCHEME = "dvnt";

// Pricing in cents
const PRICING: Record<string, number> = {
  "24h": 999,
  "7d": 3999,
  weekend: 1999,
};

// Duration → hours mapping
const DURATION_HOURS: Record<string, number> = {
  "24h": 24,
  "7d": 168,
  weekend: 72, // Fri 6pm → Mon 6am approx
};

function computeEndDate(startDate: Date, duration: string): Date {
  if (duration === "weekend") {
    // Find next Sunday 23:59 from start
    const end = new Date(startDate);
    const day = end.getDay();
    // If it's before Friday, jump to coming Sunday
    const daysUntilSunday = (7 - day) % 7 || 7;
    end.setDate(end.getDate() + daysUntilSunday);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  const hours = DURATION_HOURS[duration] || 24;
  return new Date(startDate.getTime() + hours * 60 * 60 * 1000);
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

async function verifySession(
  supabase: any,
  authHeader: string,
): Promise<string | null> {
  // Extract token
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  // Direct DB lookup of session table (Better Auth uses camelCase)
  const { data: session } = await supabase
    .from("session")
    .select("userId")
    .eq("token", token)
    .gt("expiresAt", new Date().toISOString())
    .single();

  return session?.userId || null;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const {
      event_id,
      city_id,
      duration,
      placement = "spotlight+feed",
      start_now = true,
      organizer_id,
    } = await req.json();

    if (!event_id || !duration || !organizer_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const priceCents = PRICING[duration];
    if (!priceCents) {
      return new Response(JSON.stringify({ error: "Invalid duration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // Verify session — MANDATORY, no fallback (Option A)
    const authHeader = req.headers.get("Authorization") || "";
    const userId = await verifySession(supabase, authHeader);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (userId !== organizer_id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden — session does not match organizer_id",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify event ownership
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, host_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.host_id !== organizer_id) {
      return new Response(
        JSON.stringify({ error: "Not authorized to promote this event" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Compute time window
    const startsAt = start_now ? new Date() : new Date(); // TODO: scheduled start
    const endsAt = computeEndDate(startsAt, duration);

    // Create pending campaign row
    const { data: campaign, error: campaignError } = await supabase
      .from("event_spotlight_campaigns")
      .insert({
        event_id: parseInt(event_id),
        city_id: city_id ? parseInt(city_id) : null,
        organizer_id,
        placement,
        status: "pending",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        amount_cents: priceCents,
        currency: "usd",
      })
      .select("id")
      .single();

    if (campaignError) {
      console.error(
        "[promotion-checkout] Campaign insert error:",
        campaignError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to create campaign" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Stripe Checkout Session (payment goes to DVNT platform)
    const durationLabel =
      duration === "24h"
        ? "24 Hours"
        : duration === "7d"
          ? "7 Days"
          : "Weekend";

    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(priceCents),
      "line_items[0][price_data][product_data][name]": `Event Spotlight: ${event.title}`,
      "line_items[0][price_data][product_data][description]": `${durationLabel} promotion — ${placement}`,
      "line_items[0][quantity]": "1",
      "metadata[campaign_id]": String(campaign.id),
      "metadata[event_id]": String(event_id),
      "metadata[organizer_id]": organizer_id,
      "metadata[type]": "promotion",
      success_url: `${APP_SCHEME}://events/${event_id}?promoted=true`,
      cancel_url: `${APP_SCHEME}://events/${event_id}?promoted=cancelled`,
    });

    // Update campaign with stripe PI
    await supabase
      .from("event_spotlight_campaigns")
      .update({ stripe_payment_intent_id: session.payment_intent })
      .eq("id", campaign.id);

    return new Response(
      JSON.stringify({
        url: session.url,
        campaign_id: campaign.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[promotion-checkout] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
