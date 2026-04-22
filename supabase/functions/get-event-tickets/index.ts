/**
 * get-event-tickets Edge Function
 *
 * POST /get-event-tickets
 * Body:
 *   { event_id }              → all tickets for an event (host-only view)
 *   { event_id, offline: true } → minimal payload: just qr_tokens of
 *                                 active tickets, for offline check-in
 *
 * Replaces the two direct `supabase.from("tickets")` reads that need
 * broad, per-event visibility. Both are host-only.
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

    let body: { event_id?: string | number; offline?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const eventIdNum = Number(body.event_id);
    if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
      return errorResponse("event_id required", 400);
    }

    // Host-only — and stay host-only even with co-organizer expansion;
    // co-orgs should be added here if that feature launches.
    const { data: event } = await supabase
      .from("events")
      .select("id, host_id")
      .eq("id", eventIdNum)
      .maybeSingle();
    if (!event) return errorResponse("Event not found", 404);
    if (String(event.host_id) !== String(authId)) {
      return errorResponse("Not your event", 403);
    }

    // Offline tokens variant — minimal payload, active tickets only.
    if (body.offline === true) {
      const { data, error } = await supabase
        .from("tickets")
        .select("qr_token")
        .eq("event_id", eventIdNum)
        .eq("status", "active")
        .not("qr_token", "is", null);
      if (error) {
        console.error("[get-event-tickets] offline query error:", error);
        return errorResponse("Could not fetch tokens", 500);
      }
      const qrTokens = (data || [])
        .map((t: any) => t.qr_token)
        .filter(Boolean);
      return jsonResponse({ ok: true, qr_tokens: qrTokens });
    }

    const { data, error } = await supabase
      .from("tickets")
      .select("*, ticket_types(name)")
      .eq("event_id", eventIdNum)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[get-event-tickets] query error:", error);
      return errorResponse("Could not fetch tickets", 500);
    }

    const tickets = (data || []).map((t: any) => ({
      ...t,
      ticket_type_name: t.ticket_types?.name || "General",
    }));

    return jsonResponse({ ok: true, tickets });
  } catch (err) {
    console.error("[get-event-tickets] unexpected:", err);
    return errorResponse("Internal error", 500);
  }
});
