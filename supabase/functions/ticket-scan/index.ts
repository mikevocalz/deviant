/**
 * Ticket Scan / Validate Edge Function
 *
 * POST /ticket-scan  { qr_token, qr_payload?, scanned_by?, device_id?, event_id? }
 *
 * Two validation paths:
 * 1. qr_payload (HMAC-signed) — fast-path cryptographic verification
 * 2. qr_token (legacy) — DB lookup
 *
 * Records all scans in the `checkins` audit table.
 * Transactional: UPDATE tickets SET status='scanned' WHERE active
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignedQrPayload } from "../_shared/hmac-qr.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function recordCheckin(
  supabase: any,
  ticketId: string,
  eventId: number,
  result: string,
  scannedBy?: string,
  deviceId?: string,
  offline = false,
) {
  try {
    await supabase.from("checkins").insert({
      ticket_id: ticketId,
      event_id: eventId,
      scanned_by: scannedBy || null,
      device_id: deviceId || null,
      result,
      offline,
    });
  } catch (e) {
    console.error("[ticket-scan] Checkin record error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { qr_token, qr_payload, scanned_by, device_id, event_id } =
      await req.json();

    if (!qr_token && !qr_payload) {
      return json({ error: "Missing qr_token or qr_payload" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    let ticketId: string | null = null;
    let ticketEventId: number | null = null;

    // ── Fast path: HMAC-signed QR payload ────────────────────
    if (qr_payload) {
      const verification = await verifySignedQrPayload(qr_payload);
      if (!verification.valid) {
        return json({ valid: false, reason: "invalid_signature" });
      }
      ticketId = verification.ticketId!;
      ticketEventId = verification.eventId!;

      // Optionally verify event_id matches (prevents cross-event replay)
      if (event_id && ticketEventId !== parseInt(event_id)) {
        await recordCheckin(
          supabase,
          ticketId,
          ticketEventId,
          "wrong_event",
          scanned_by,
          device_id,
        );
        return json({ valid: false, reason: "wrong_event" });
      }
    }

    // ── Atomic check-in by ticket ID (from HMAC) or qr_token (legacy) ──
    let updateQuery = supabase
      .from("tickets")
      .update({
        status: "scanned",
        checked_in_at: new Date().toISOString(),
        checked_in_by: scanned_by || null,
      })
      .eq("status", "active");

    if (ticketId) {
      updateQuery = updateQuery.eq("id", ticketId);
    } else {
      updateQuery = updateQuery.eq("qr_token", qr_token);
    }

    const { data: ticket, error } = await updateQuery
      .select(
        "id, event_id, ticket_type_id, user_id, status, qr_token, checked_in_at, purchase_amount_cents",
      )
      .single();

    if (error || !ticket) {
      // Check if ticket exists but isn't active
      let existingQuery = supabase
        .from("tickets")
        .select("id, event_id, status, checked_in_at");

      if (ticketId) {
        existingQuery = existingQuery.eq("id", ticketId);
      } else {
        existingQuery = existingQuery.eq("qr_token", qr_token);
      }

      const { data: existing } = await existingQuery.single();

      if (existing) {
        const reason =
          existing.status === "scanned"
            ? "already_scanned"
            : existing.status === "refunded"
              ? "refunded"
              : "invalid_status";

        await recordCheckin(
          supabase,
          existing.id,
          existing.event_id,
          reason,
          scanned_by,
          device_id,
        );

        return json({
          valid: false,
          reason,
          status: existing.status,
          checked_in_at: existing.checked_in_at,
        });
      }

      return json({ valid: false, reason: "not_found" });
    }

    // ── Record successful checkin ────────────────────────────
    await recordCheckin(
      supabase,
      ticket.id,
      ticket.event_id,
      "valid",
      scanned_by,
      device_id,
    );

    // Fetch user info for display
    const { data: user } = await supabase
      .from("users")
      .select("username, first_name, last_name")
      .eq("auth_id", ticket.user_id)
      .single();

    // Fetch ticket type name
    const { data: ticketType } = await supabase
      .from("ticket_types")
      .select("name")
      .eq("id", ticket.ticket_type_id)
      .single();

    return json({
      valid: true,
      ticket: {
        ...ticket,
        username: user?.username || "Unknown",
        name:
          [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
          user?.username ||
          "Guest",
        tier_name: ticketType?.name || "General",
      },
    });
  } catch (err: any) {
    console.error("[ticket-scan] Error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
