/**
 * Organizer API — Stripe Connect + event management
 */

import { supabase } from "../supabase/client";
import { getCurrentUserAuthId } from "./auth-helper";

export const organizerApi = {
  /**
   * Start Stripe Connect Express onboarding
   */
  async startOnboarding(): Promise<{ url?: string; error?: string }> {
    try {
      const hostId = await getCurrentUserAuthId();
      if (!hostId) return { error: "Not authenticated" };

      const { data, error } = await supabase.functions.invoke("organizer-connect", {
        body: { action: "start", host_id: hostId },
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error("[Organizer] startOnboarding error:", err);
      return { error: err.message || "Failed to start onboarding" };
    }
  },

  /**
   * Get current organizer account status
   */
  async getStatus(): Promise<{
    connected: boolean;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
  }> {
    try {
      const hostId = await getCurrentUserAuthId();
      if (!hostId) return { connected: false };

      const { data, error } = await supabase.functions.invoke("organizer-connect", {
        body: { action: "status", host_id: hostId },
      });

      if (error) throw error;
      return data || { connected: false };
    } catch (err: any) {
      console.error("[Organizer] getStatus error:", err);
      return { connected: false };
    }
  },

  /**
   * Get payout info for an event
   */
  async getEventPayout(eventId: string) {
    try {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("event_id", parseInt(eventId))
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (err) {
      console.error("[Organizer] getEventPayout error:", err);
      return null;
    }
  },

  /**
   * Report an event
   */
  async reportEvent(eventId: string, reason: string, details?: string) {
    try {
      const reporterId = await getCurrentUserAuthId();
      if (!reporterId) throw new Error("Not authenticated");

      const { error } = await supabase.from("reports_events").insert({
        event_id: parseInt(eventId),
        reporter_id: reporterId,
        reason,
        details: details || null,
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error("[Organizer] reportEvent error:", err);
      return { success: false, error: err.message };
    }
  },
};
