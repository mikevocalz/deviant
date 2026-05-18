/**
 * invite-co-organizer Edge Function
 *
 * POST /invite-co-organizer
 * Body: { event_id, invitee_auth_id, role? }
 *
 * - Verifies caller is the event host
 * - Inserts/upserts into event_co_organizers (accepted: false)
 * - Inserts an event_invite notification for the invitee
 * - Fires a push notification via send_notification
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

    const callerAuthId = await verifySession(supabase, req);
    if (!callerAuthId) return errorResponse("Unauthorized", 401);

    let body: { event_id?: string | number; invitee_auth_id?: string; role?: string } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const eventIdNum = Number(body.event_id);
    if (!Number.isFinite(eventIdNum) || eventIdNum <= 0) {
      return errorResponse("event_id required", 400);
    }
    const inviteeAuthId = body.invitee_auth_id?.trim();
    if (!inviteeAuthId) return errorResponse("invitee_auth_id required", 400);

    const role = body.role || "editor";
    if (!["viewer", "scanner", "editor", "admin"].includes(role)) {
      return errorResponse("Invalid role", 400);
    }

    // Verify caller is the event host
    const { data: event } = await supabase
      .from("events")
      .select("id, host_id, title")
      .eq("id", eventIdNum)
      .maybeSingle();

    if (!event) return errorResponse("Event not found", 404);
    if (String(event.host_id) !== String(callerAuthId)) {
      return errorResponse("Only the host can invite co-organizers", 403);
    }

    // Upsert co-organizer row
    const { error: upsertErr } = await supabase
      .from("event_co_organizers")
      .upsert(
        {
          event_id: eventIdNum,
          user_id: inviteeAuthId,
          role,
          invited_by: callerAuthId,
          accepted: false,
        },
        { onConflict: "event_id,user_id" },
      );

    if (upsertErr) {
      console.error("[invite-co-organizer] upsert error:", upsertErr);
      return errorResponse("Failed to add co-organizer", 500);
    }

    // Resolve invitee integer user ID
    const { data: inviteeUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", inviteeAuthId)
      .maybeSingle();

    if (!inviteeUser?.id) {
      // Co-organizer row saved; they just won't get a notification yet
      console.warn("[invite-co-organizer] invitee not in users table:", inviteeAuthId);
      return jsonResponse({ ok: true, notified: false });
    }

    // Resolve host integer user ID (actor for notification)
    const { data: hostUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", callerAuthId)
      .maybeSingle();

    // Insert notification row
    const { error: notifErr } = await supabase.from("notifications").insert({
      recipient_id: inviteeUser.id,
      actor_id: hostUser?.id || null,
      type: "event_invite",
      entity_type: "event",
      entity_id: String(eventIdNum),
    });

    if (notifErr) {
      console.error("[invite-co-organizer] notification insert error:", notifErr);
      // Non-fatal — co-organizer row already saved
    }

    // Fire push notification (best-effort)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send_notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          userId: inviteeUser.id,
          title: "You've been invited to co-organize",
          body: `You've been invited to help organize "${event.title}". Tap to accept.`,
          type: "event_invite",
          data: { entityType: "event", entityId: String(eventIdNum) },
        }),
      });
    } catch (pushErr) {
      console.error("[invite-co-organizer] push error:", pushErr);
    }

    console.log(
      `[invite-co-organizer] Invited ${inviteeAuthId} to event ${eventIdNum} as ${role}`,
    );
    return jsonResponse({ ok: true, notified: true });
  } catch (err: any) {
    console.error("[invite-co-organizer] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
