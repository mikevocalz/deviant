/**
 * Event Analytics Edge Function
 *
 * POST /event-analytics
 * Body: { event_id: string | number }
 *
 * Returns a summary of a single event for its organizer:
 *   - revenue       : gross / dvnt fee / stripe fee / net cents (from event_financials)
 *   - tickets       : total, active, checked_in, refunded, void, transfer_pending
 *   - tiers         : per-tier sold/remaining/revenue
 *   - promoCodes    : code usage stats (top 5 by uses)
 *
 * Access control:
 *   Only the event host (events.host_id === authId) can read analytics.
 *
 * This function intentionally does NOT hit Stripe — all numbers come from
 * Supabase tables that are already maintained by webhooks + triggers, so
 * the response is fast and dependable even when Stripe is flaky.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  verifySession,
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "../_shared/verify-session.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    const authId = await verifySession(supabase, req);
    if (!authId) return errorResponse("Unauthorized", 401);

    let body: { event_id?: string | number } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const eventIdNum = Number(body.event_id);
    if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
      return errorResponse("event_id required", 400);
    }

    // Host check — only the event owner can see analytics
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, host_id, title")
      .eq("id", eventIdNum)
      .maybeSingle();

    if (eventErr) {
      console.error("[event-analytics] event lookup error:", eventErr);
      return errorResponse("Event lookup failed", 500);
    }
    if (!event) return errorResponse("Event not found", 404);
    if (String(event.host_id) !== String(authId)) {
      return errorResponse("Not your event", 403);
    }

    // ── 1. Revenue — event_financials is maintained by the webhook ──
    const { data: financials } = await supabase
      .from("event_financials")
      .select(
        "gross_cents, refunds_cents, dvnt_fee_cents, stripe_fee_cents, net_cents, calculated_at",
      )
      .eq("event_id", eventIdNum)
      .maybeSingle();

    const revenue = {
      grossCents: Number(financials?.gross_cents ?? 0),
      refundsCents: Number(financials?.refunds_cents ?? 0),
      dvntFeeCents: Number(financials?.dvnt_fee_cents ?? 0),
      stripeFeeCents: Number(financials?.stripe_fee_cents ?? 0),
      netCents: Number(financials?.net_cents ?? 0),
      calculatedAt: financials?.calculated_at ?? null,
    };

    // ── 2. Ticket status breakdown ──
    const { data: ticketRows, error: ticketsErr } = await supabase
      .from("tickets")
      .select("id, ticket_type_id, status, checked_in_at, purchase_amount_cents")
      .eq("event_id", eventIdNum);

    if (ticketsErr) {
      console.error("[event-analytics] tickets error:", ticketsErr);
      return errorResponse("Ticket stats failed", 500);
    }

    const tickets = ticketRows || [];
    // A ticket counts as checked-in if EITHER checked_in_at is set OR the
    // status is "scanned" — some code paths set only one.
    let checkedIn = 0;
    let active = 0;
    let refunded = 0;
    let voidCount = 0;
    let transferPending = 0;
    for (const t of tickets) {
      const isCheckedIn = t.checked_in_at != null || t.status === "scanned";
      if (isCheckedIn) checkedIn++;
      else if (t.status === "active") active++;
      else if (t.status === "refunded") refunded++;
      else if (t.status === "void") voidCount++;
      else if (t.status === "transfer_pending") transferPending++;
    }
    const ticketStats = {
      total: tickets.length,
      active,
      checkedIn,
      refunded,
      void: voidCount,
      transferPending,
    };

    // ── 3. Per-tier breakdown ──
    const { data: tierRows } = await supabase
      .from("ticket_types")
      .select(
        "id, name, price_cents, quantity_total, quantity_sold, is_active",
      )
      .eq("event_id", eventIdNum)
      .order("price_cents", { ascending: true });

    const tierRevenueCentsById = new Map<string, number>();
    for (const t of tickets) {
      const key = String(t.ticket_type_id);
      const prev = tierRevenueCentsById.get(key) ?? 0;
      tierRevenueCentsById.set(
        key,
        prev + Number(t.purchase_amount_cents || 0),
      );
    }

    const tiers = (tierRows || []).map((t: any) => {
      const quantityTotal = Number(t.quantity_total || 0);
      const quantitySold = Number(t.quantity_sold || 0);
      const remaining = Math.max(0, quantityTotal - quantitySold);
      const percentSold =
        quantityTotal > 0
          ? Math.min(100, Math.round((quantitySold / quantityTotal) * 100))
          : 0;
      return {
        id: String(t.id),
        name: t.name,
        priceCents: Number(t.price_cents || 0),
        quantityTotal,
        quantitySold,
        remaining,
        percentSold,
        revenueCents: tierRevenueCentsById.get(String(t.id)) ?? 0,
        isActive: t.is_active !== false,
      };
    });

    // ── 4. Promo codes (top 5 by uses) ──
    const { data: promoRows } = await supabase
      .from("promo_codes")
      .select("id, code, discount_type, discount_value, uses_count, max_uses")
      .eq("event_id", eventIdNum)
      .order("uses_count", { ascending: false })
      .limit(5);

    const promoCodes = (promoRows || []).map((p: any) => ({
      id: String(p.id),
      code: p.code,
      discountType: p.discount_type,
      discountValue: Number(p.discount_value || 0),
      usesCount: Number(p.uses_count || 0),
      maxUses: p.max_uses == null ? null : Number(p.max_uses),
    }));

    return jsonResponse({
      ok: true,
      eventId: String(eventIdNum),
      title: event.title || "",
      revenue,
      ticketStats,
      tiers,
      promoCodes,
    });
  } catch (err: any) {
    console.error("[event-analytics] Unexpected error:", err);
    return errorResponse(err?.message || "Internal error", 500);
  }
});
