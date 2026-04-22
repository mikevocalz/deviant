/**
 * Event Waitlist API
 *
 * Backed by supabase/functions/event-waitlist. Idempotent join/leave +
 * a status check used by the event detail screen to render the right
 * CTA when a tier is sold out.
 */

import { supabase } from "../supabase/client";
import { requireBetterAuthToken } from "../auth/identity";

export interface WaitlistStatus {
  joined: boolean;
  id: string | null;
  createdAt: string | null;
}

interface BaseArgs {
  eventId: string | number;
  ticketTypeId?: string | null;
}

async function call(action: string, args: BaseArgs): Promise<any> {
  const token = await requireBetterAuthToken();
  const { data, error } = await supabase.functions.invoke("event-waitlist", {
    body: {
      event_id: args.eventId,
      ticket_type_id: args.ticketTypeId ?? null,
      action,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      "x-auth-token": token,
    },
  });
  if (error) throw new Error(error.message || "Waitlist request failed");
  if (!data || data.ok !== true) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as any).error || "")
        : "Waitlist request failed";
    throw new Error(msg);
  }
  return data;
}

export const eventWaitlistApi = {
  async getStatus(args: BaseArgs): Promise<WaitlistStatus> {
    try {
      const r = await call("status", args);
      return {
        joined: !!r.joined,
        id: r.id ?? null,
        createdAt: r.createdAt ?? null,
      };
    } catch (err) {
      console.error("[Waitlist] getStatus error:", err);
      return { joined: false, id: null, createdAt: null };
    }
  },

  async join(args: BaseArgs): Promise<WaitlistStatus> {
    const r = await call("join", args);
    return {
      joined: true,
      id: r.id ?? null,
      createdAt: r.createdAt ?? null,
    };
  },

  async leave(args: BaseArgs): Promise<void> {
    await call("leave", args);
  },
};
