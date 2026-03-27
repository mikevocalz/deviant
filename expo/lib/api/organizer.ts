/**
 * Organizer API — Stripe Connect + event management
 */

import { supabase } from "../supabase/client";
import { requireBetterAuthToken } from "../auth/identity";
import { getCurrentUserAuthId } from "./auth-helper";

export type OnboardingResult = {
  url?: string;
  account_id?: string;
  error?: string;
};

export type OrganizerStatus = {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  stripe_account_id?: string;
  pending_verification?: string[];
};

/** Validate that a value is a usable HTTPS URL */
function isValidHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("https://")) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const organizerApi = {
  /**
   * Start Stripe Connect Express onboarding
   */
  async startOnboarding(): Promise<OnboardingResult> {
    try {
      const token = await requireBetterAuthToken();
      console.log("[Organizer] startOnboarding: invoking edge function");

      const { data, error } = await supabase.functions.invoke(
        "organizer-connect",
        {
          body: { action: "start" },
          headers: { "x-auth-token": token },
        },
      );

      if (error) {
        console.error("[Organizer] invoke error:", error.message);
        return { error: error.message };
      }

      console.log(
        "[Organizer] startOnboarding response keys:",
        data ? Object.keys(data) : "null",
      );

      // Edge function always returns 200 — errors are in data.error
      if (data?.error) {
        console.error("[Organizer] edge error:", data.error);
        return { error: data.error };
      }

      // Validate URL before returning to caller
      if (data?.url && !isValidHttpsUrl(data.url)) {
        console.error(
          "[Organizer] invalid URL received:",
          typeof data.url,
          String(data.url).substring(0, 60),
        );
        return { error: "Received invalid onboarding URL from server" };
      }

      return { url: data?.url, account_id: data?.account_id };
    } catch (err: any) {
      console.error("[Organizer] startOnboarding error:", err);
      return { error: err.message || "Failed to start onboarding" };
    }
  },

  /**
   * Get current organizer account status
   */
  async getStatus(): Promise<OrganizerStatus> {
    try {
      const token = await requireBetterAuthToken();

      const { data, error } = await supabase.functions.invoke(
        "organizer-connect",
        {
          body: { action: "status" },
          headers: { "x-auth-token": token },
        },
      );

      if (error) throw error;
      if (data?.error) {
        console.error("[Organizer] getStatus edge error:", data.error);
        return { connected: false };
      }
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
