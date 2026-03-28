/**
 * Promotions API — Client-side queries for event spotlight campaigns.
 * All heavy lifting is done via RPC functions (single round-trip, no N+1).
 */

import { supabase } from "../supabase/client";
import { getCurrentUserAuthId } from "./auth-helper";
import type {
  SpotlightItem,
  SpotlightCampaign,
  PromotionDuration,
  CampaignPlacement,
} from "@/src/events/promotion-types";

const _rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_URL =
  typeof _rawSupabaseUrl === "string" && _rawSupabaseUrl.startsWith("https://")
    ? _rawSupabaseUrl
    : "https://npfjanxturvmjyevoyfo.supabase.co";

export const promotionsApi = {
  /**
   * Get active spotlight feed items for a city.
   * Returns up to 8 promoted events with image + event summary.
   */
  async getSpotlightFeed(cityId?: number | null): Promise<SpotlightItem[]> {
    try {
      const { data, error } = await supabase.rpc("get_spotlight_feed", {
        p_city_id: cityId ?? null,
      });

      if (error) throw error;

      const items = Array.isArray(data) ? data : [];
      return items as SpotlightItem[];
    } catch (error) {
      console.error("[Promotions] getSpotlightFeed error:", error);
      return [];
    }
  },

  /**
   * Get promoted event IDs for the feed (used for is_promoted flag).
   * Returns a Set of event IDs that have active feed campaigns.
   */
  async getPromotedEventIds(cityId?: number | null): Promise<Set<number>> {
    try {
      const { data, error } = await supabase.rpc("get_promoted_event_ids", {
        p_city_id: cityId ?? null,
      });

      if (error) throw error;

      const ids = new Set<number>();
      if (Array.isArray(data)) {
        for (const row of data) {
          ids.add(row.event_id);
        }
      }
      return ids;
    } catch (error) {
      console.error("[Promotions] getPromotedEventIds error:", error);
      return new Set();
    }
  },

  /**
   * Get campaigns for a specific event (organizer view).
   */
  async getEventCampaigns(eventId: string): Promise<SpotlightCampaign[]> {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return [];

      const { data, error } = await supabase.rpc("get_event_campaigns", {
        p_event_id: parseInt(eventId),
        p_organizer_id: authId,
      });

      if (error) throw error;

      return Array.isArray(data) ? (data as SpotlightCampaign[]) : [];
    } catch (error) {
      console.error("[Promotions] getEventCampaigns error:", error);
      return [];
    }
  },

  /**
   * Create a promotion checkout session via Edge Function.
   * Returns a Stripe Checkout URL for the organizer to complete payment.
   */
  async createPromotionCheckout(params: {
    eventId: string;
    cityId?: number | null;
    duration: PromotionDuration;
    placement: CampaignPlacement;
    startNow: boolean;
  }): Promise<{ url?: string; error?: string; campaign_id?: number }> {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return { error: "Not authenticated" };

      const { data: sessionData } = await supabase.auth.getSession();
      const token =
        sessionData?.session?.access_token || (await getCurrentUserAuthId());

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/promotion-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_id: params.eventId,
            city_id: params.cityId ?? null,
            duration: params.duration,
            placement: params.placement,
            start_now: params.startNow,
            organizer_id: authId,
          }),
        },
      );

      const result = await res.json();

      if (!res.ok) {
        return { error: result.error || "Checkout failed" };
      }

      return result;
    } catch (error: any) {
      console.error("[Promotions] createPromotionCheckout error:", error);
      return { error: error.message || "Network error" };
    }
  },

  /**
   * Cancel an active campaign via gateway (Option A — no direct table writes).
   */
  async cancelCampaign(campaignId: number): Promise<{ success: boolean }> {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return { success: false };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";

      const res = await fetch(`${SUPABASE_URL}/functions/v1/promotion-cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      const result = await res.json();
      if (!res.ok) {
        console.error("[Promotions] cancelCampaign error:", result.error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      console.error("[Promotions] cancelCampaign error:", error);
      return { success: false };
    }
  },
};
