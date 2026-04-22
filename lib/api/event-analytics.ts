/**
 * Event Analytics API
 *
 * Host-only read of aggregate numbers for a single event.
 * Backed by supabase/functions/event-analytics — one JSON round trip.
 */

import { supabase } from "../supabase/client";
import { requireBetterAuthToken } from "../auth/identity";

export interface EventRevenueSummary {
  grossCents: number;
  refundsCents: number;
  dvntFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
  calculatedAt: string | null;
}

export interface EventTicketStats {
  total: number;
  active: number;
  checkedIn: number;
  refunded: number;
  void: number;
  transferPending: number;
}

export interface EventTierAnalytics {
  id: string;
  name: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  remaining: number;
  percentSold: number;
  revenueCents: number;
  isActive: boolean;
}

export interface EventPromoCodeAnalytics {
  id: string;
  code: string;
  discountType: "percent" | "fixed_cents" | string;
  discountValue: number;
  usesCount: number;
  maxUses: number | null;
}

export interface EventAnalyticsSummary {
  eventId: string;
  title: string;
  revenue: EventRevenueSummary;
  ticketStats: EventTicketStats;
  tiers: EventTierAnalytics[];
  promoCodes: EventPromoCodeAnalytics[];
}

export const eventAnalyticsApi = {
  async getSummary(eventId: string | number): Promise<EventAnalyticsSummary | null> {
    try {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<
        | ({ ok: true } & EventAnalyticsSummary)
        | { ok: false; error?: string }
      >("event-analytics", {
        body: { event_id: eventId },
        headers: {
          Authorization: `Bearer ${token}`,
          "x-auth-token": token,
        },
      });

      if (error) {
        console.error("[EventAnalytics] edge error:", error);
        return null;
      }
      if (!data || data.ok !== true) {
        if (data && "error" in data && data.error) {
          console.error("[EventAnalytics] edge returned error:", data.error);
        }
        return null;
      }
      const { ok: _ok, ...rest } = data;
      return rest;
    } catch (err) {
      console.error("[EventAnalytics] getSummary error:", err);
      return null;
    }
  },
};
