import { supabase } from "../supabase/client";
import { getCurrentUserAuthId, getCurrentUserId } from "./auth-helper";

export interface TicketRecord {
  id: string;
  event_id: number;
  ticket_type_id: string;
  user_id: string;
  status: "active" | "scanned" | "refunded" | "void";
  qr_token: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  purchase_amount_cents: number | null;
  created_at: string;
  // Joined fields
  ticket_type_name?: string;
  event_title?: string;
  event_image?: string;
  event_date?: string;
  event_location?: string;
  username?: string;
}

export const ticketsApi = {
  /**
   * Get all tickets for an event (organizer view)
   */
  async getEventTickets(eventId: string): Promise<TicketRecord[]> {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, ticket_types(name)")
        .eq("event_id", parseInt(eventId))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        ticket_type_name: t.ticket_types?.name || "General",
      }));
    } catch (error) {
      console.error("[Tickets] getEventTickets error:", error);
      return [];
    }
  },

  /**
   * Get current user's tickets across all events
   */
  async getMyTickets(): Promise<TicketRecord[]> {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return [];

      // Query by auth_id, and also by integer user ID string as fallback
      // (tickets created before the auth_id fix may have stored user.id instead)
      const intId = getCurrentUserId();
      const userIdFilter =
        intId && intId !== authId
          ? `user_id.eq.${authId},user_id.eq.${intId}`
          : `user_id.eq.${authId}`;

      const { data, error } = await supabase
        .from("tickets")
        .select(
          "*, ticket_types(name), events(title, cover_image_url, start_date, location)",
        )
        .or(userIdFilter)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        ticket_type_name: t.ticket_types?.name || "General",
        event_title: t.events?.title || "",
        event_image: t.events?.cover_image_url || "",
        event_date: t.events?.start_date || "",
        event_location: t.events?.location || "",
      }));
    } catch (error) {
      console.error("[Tickets] getMyTickets error:", error);
      return [];
    }
  },

  /**
   * Purchase tickets (free or paid via Stripe Checkout)
   */
  async checkout(params: {
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    userId: string;
  }): Promise<{
    url?: string;
    tickets?: any[];
    free?: boolean;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "ticket-checkout",
        {
          body: {
            event_id: params.eventId,
            ticket_type_id: params.ticketTypeId,
            quantity: params.quantity,
            user_id: params.userId,
          },
        },
      );

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("[Tickets] checkout error:", error);
      return { error: error.message || "Checkout failed" };
    }
  },

  /**
   * Scan/validate a ticket by QR token (organizer)
   */
  async scanTicket(
    qrToken: string,
    scannedBy?: string,
  ): Promise<{
    valid: boolean;
    reason?: string;
    ticket?: any;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke("ticket-scan", {
        body: { qr_token: qrToken, scanned_by: scannedBy },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("[Tickets] scanTicket error:", error);
      return { valid: false, reason: "network_error" };
    }
  },

  /**
   * Get ticket types for an event
   */
  async getTicketTypes(eventId: string) {
    try {
      const { data, error } = await supabase
        .from("ticket_types")
        .select("*")
        .eq("event_id", parseInt(eventId))
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[Tickets] getTicketTypes error:", error);
      return [];
    }
  },

  /**
   * Get event financials (organizer)
   */
  async getEventFinancials(eventId: string) {
    try {
      const { data, error } = await supabase
        .from("event_financials")
        .select("*")
        .eq("event_id", parseInt(eventId))
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error("[Tickets] getEventFinancials error:", error);
      return null;
    }
  },

  /**
   * Download all active QR tokens for an event (offline check-in).
   * Returns array of qr_token strings that the host can validate locally.
   */
  async downloadOfflineTokens(eventId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("qr_token")
        .eq("event_id", parseInt(eventId))
        .in("status", ["active"])
        .not("qr_token", "is", null);

      if (error) throw error;
      return (data || []).map((t: any) => t.qr_token).filter(Boolean);
    } catch (error) {
      console.error("[Tickets] downloadOfflineTokens error:", error);
      return [];
    }
  },

  /**
   * Sync offline scans back to the server.
   * Calls ticket-scan edge function for each pending scan.
   */
  async syncOfflineScans(
    scans: { qrToken: string; scannedAt: string; scannedBy?: string }[],
  ): Promise<{ synced: string[]; failed: string[] }> {
    const synced: string[] = [];
    const failed: string[] = [];
    for (const scan of scans) {
      try {
        const { data, error } = await supabase.functions.invoke("ticket-scan", {
          body: {
            qr_token: scan.qrToken,
            scanned_by: scan.scannedBy,
            offline_scanned_at: scan.scannedAt,
          },
        });
        if (error) throw error;
        synced.push(scan.qrToken);
      } catch {
        failed.push(scan.qrToken);
      }
    }
    return { synced, failed };
  },

  /**
   * Issue a ticket for a free RSVP (legacy path when ticketing is OFF).
   * Creates a real DB row with a crypto-random token via server-side RPC.
   */
  async issueRsvpTicket(params: { eventId: string; userId: string }): Promise<{
    id: string;
    qr_token: string;
    already_existed: boolean;
  } | null> {
    try {
      const { data, error } = await supabase.rpc("issue_rsvp_ticket", {
        p_event_id: parseInt(params.eventId),
        p_user_auth_id: params.userId,
      });

      if (error) throw error;
      return data as { id: string; qr_token: string; already_existed: boolean };
    } catch (error) {
      console.error("[Tickets] issueRsvpTicket error:", error);
      return null;
    }
  },

  /**
   * Get current user's ticket for a specific event
   */
  async getMyTicketForEvent(eventId: string): Promise<TicketRecord | null> {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return null;

      // Query by auth_id + integer user ID string fallback (same as getMyTickets)
      const intId = getCurrentUserId();
      const userIdFilter =
        intId && intId !== authId
          ? `user_id.eq.${authId},user_id.eq.${intId}`
          : `user_id.eq.${authId}`;

      const { data, error } = await supabase
        .from("tickets")
        .select(
          "*, ticket_types(name), events(title, cover_image_url, start_date, end_date, location)",
        )
        .or(userIdFilter)
        .eq("event_id", parseInt(eventId))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        ticket_type_name: data.ticket_types?.name || "General",
        event_title: data.events?.title || "",
        event_image: data.events?.cover_image_url || "",
        event_date: data.events?.start_date || "",
        event_location: data.events?.location || "",
      } as TicketRecord;
    } catch (error) {
      console.error("[Tickets] getMyTicketForEvent error:", error);
      return null;
    }
  },

  // Legacy compat
  async checkInTicket(ticketId: string): Promise<{ success: boolean }> {
    return { success: false };
  },
  async checkIn(data: {
    qrToken: string;
  }): Promise<{ success: boolean; alreadyCheckedIn?: boolean }> {
    const result = await ticketsApi.scanTicket(data.qrToken);
    return {
      success: result.valid,
      alreadyCheckedIn: result.reason === "already_scanned",
    };
  },
};

export const tickets = ticketsApi;
