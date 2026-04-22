/**
 * Event Spotlight Edge Function
 *
 * POST /event-spotlight
 * Body:
 *   { action: "create", event_id, placement, duration_hours,
 *     amount_cents?, city_id?, priority? }       → Stripe Checkout URL
 *   { action: "cancel", campaign_id }            → cancel a campaign
 *   { action: "list_my", event_id }              → host's campaigns for event
 *   { action: "expire_due" }                     → sweep expired campaigns
 *
 * Host-only for create / cancel / list_my. `expire_due` is unauthed but
 * only flips status — it can be called from a cron ping.
 *
 * Create flow:
 *   1. Verify caller is host of event
 *   2. Insert pending campaign row
 *   3. Create a Stripe Checkout Session charging the buyer directly
 *      (no connected account — DVNT keeps the full spotlight spend;
 *      this is a platform revenue product, not a host payout)
 *   4. Return Checkout URL. On payment success the stripe-webhook
 *      flips the campaign status to 'active'.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  verifySession,
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "../_shared/verify-session.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_SCHEME = "dvnt";

const PLACEMENTS = new Set(["spotlight", "feed", "spotlight+feed"]);

// Minimum prices per placement type (hours × rate). The client picks a
// duration — this table is the canonical cost so a tampered client can't
// pay $1 for a $100 campaign.
const HOURLY_RATES: Record<string, number> = {
  spotlight: 350, // $3.50/hour
  feed: 200, //      $2.00/hour
  "spotlight+feed": 500, // $5.00/hour
};

function computeAmountCents(placement: string, durationHours: number): number {
  const rate = HOURLY_RATES[placement];
  if (!rate) return 0;
  return rate * Math.max(1, Math.min(durationHours, 7 * 24));
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
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    const action = (body.action || "").toString();

    // ── action: expire_due ───────────────────────────
    // Unauthenticated sweep endpoint — flips campaigns past ends_at
    // from 'active' to 'expired'. Safe to call publicly because
    // it's a no-op on non-expired rows. In production, invoke from
    // a Supabase cron or the app's SessionStart hook.
    if (action === "expire_due") {
      await supabase.rpc("expire_spotlight_campaigns");
      return jsonResponse({ ok: true });
    }

    const authId = await verifySession(supabase, req);
    if (!authId) return errorResponse("Unauthorized", 401);

    // Rate limit all mutating actions per caller.
    const rl = checkRateLimit(authId, "event-spotlight", {
      maxRequests: 15,
      windowMs: 60_000,
    });
    if (!rl.allowed) return errorResponse("Too many requests", 429);

    // ── action: list_my ──────────────────────────────
    if (action === "list_my") {
      const eventIdNum = Number(body.event_id);
      if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
        return errorResponse("event_id required", 400);
      }

      // Verify caller is the event host
      const { data: event } = await supabase
        .from("events")
        .select("host_id")
        .eq("id", eventIdNum)
        .maybeSingle();
      if (!event) return errorResponse("Event not found", 404);
      if (String(event.host_id) !== String(authId)) {
        return errorResponse("Not your event", 403);
      }

      const { data: campaigns, error } = await supabase
        .from("event_spotlight_campaigns")
        .select(
          "id, placement, priority, status, starts_at, ends_at, amount_cents, currency, created_at, updated_at, stripe_payment_intent_id",
        )
        .eq("event_id", eventIdNum)
        .eq("organizer_id", authId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[event-spotlight] list_my error:", error);
        return errorResponse("Could not fetch campaigns", 500);
      }
      return jsonResponse({ ok: true, campaigns: campaigns || [] });
    }

    // ── action: cancel ───────────────────────────────
    if (action === "cancel") {
      const campaignId = Number(body.campaign_id);
      if (!Number.isFinite(campaignId) || campaignId <= 0) {
        return errorResponse("campaign_id required", 400);
      }
      const { data: c } = await supabase
        .from("event_spotlight_campaigns")
        .select("id, organizer_id, status")
        .eq("id", campaignId)
        .maybeSingle();
      if (!c) return errorResponse("Campaign not found", 404);
      if (String(c.organizer_id) !== String(authId)) {
        return errorResponse("Not your campaign", 403);
      }
      if (c.status === "cancelled" || c.status === "expired") {
        return jsonResponse({ ok: true, alreadyClosed: true });
      }
      const { error } = await supabase
        .from("event_spotlight_campaigns")
        .update({ status: "cancelled" })
        .eq("id", campaignId);
      if (error) {
        console.error("[event-spotlight] cancel error:", error);
        return errorResponse("Could not cancel campaign", 500);
      }
      return jsonResponse({ ok: true });
    }

    // ── action: create ───────────────────────────────
    if (action === "create") {
      const eventIdNum = Number(body.event_id);
      if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
        return errorResponse("event_id required", 400);
      }
      const placement = (body.placement || "").toString();
      if (!PLACEMENTS.has(placement)) {
        return errorResponse("Invalid placement", 400);
      }
      const durationHours = Number(body.duration_hours);
      if (
        !Number.isFinite(durationHours) ||
        durationHours < 1 ||
        durationHours > 7 * 24
      ) {
        return errorResponse("duration_hours must be 1–168", 400);
      }
      const cityId =
        body.city_id != null && Number.isFinite(Number(body.city_id))
          ? Number(body.city_id)
          : null;
      const priority =
        body.priority != null && Number.isFinite(Number(body.priority))
          ? Math.max(0, Math.min(100, Number(body.priority)))
          : 0;

      // Verify caller is the event host
      const { data: event } = await supabase
        .from("events")
        .select("id, host_id, title")
        .eq("id", eventIdNum)
        .maybeSingle();
      if (!event) return errorResponse("Event not found", 404);
      if (String(event.host_id) !== String(authId)) {
        return errorResponse("Not your event", 403);
      }

      const amountCents = computeAmountCents(placement, durationHours);
      if (amountCents <= 0) return errorResponse("Invalid pricing", 400);

      const now = new Date();
      const endsAt = new Date(now.getTime() + durationHours * 3600_000);

      // Insert pending row — webhook will flip to 'active' once paid.
      const { data: campaign, error: insertErr } = await supabase
        .from("event_spotlight_campaigns")
        .insert({
          event_id: eventIdNum,
          city_id: cityId,
          organizer_id: authId,
          placement,
          priority,
          status: "pending",
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          amount_cents: amountCents,
          currency: "usd",
        })
        .select("id")
        .single();
      if (insertErr || !campaign) {
        console.error("[event-spotlight] insert error:", insertErr);
        return errorResponse("Could not create campaign", 500);
      }

      // Stripe Checkout — plain destination-less charge. DVNT keeps 100%.
      const successUrl = `${APP_SCHEME}://events/${eventIdNum}?spotlight=ok`;
      const cancelUrl = `${APP_SCHEME}://events/${eventIdNum}?spotlight=cancelled`;
      const session = await stripeRequest("/checkout/sessions", {
        mode: "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": amountCents.toString(),
        "line_items[0][price_data][product_data][name]": `Promote "${event.title || "Event"}"`,
        "line_items[0][price_data][product_data][description]":
          `${durationHours}h · ${placement.replace("+", " + ")} placement`,
        "line_items[0][quantity]": "1",
        "metadata[type]": "event_spotlight",
        "metadata[campaign_id]": String(campaign.id),
        "metadata[event_id]": String(eventIdNum),
        "metadata[organizer_id]": authId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return jsonResponse({
        ok: true,
        campaign_id: campaign.id,
        url: session.url,
        amount_cents: amountCents,
        ends_at: endsAt.toISOString(),
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err: any) {
    console.error("[event-spotlight] unexpected:", err);
    return errorResponse("Internal error", 500);
  }
});
