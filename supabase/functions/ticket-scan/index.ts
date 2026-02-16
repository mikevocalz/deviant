/**
 * Ticket Scan / Validate Edge Function
 *
 * POST /ticket-scan  { qr_token, scanned_by }
 *
 * Transactional: UPDATE tickets SET status='scanned' WHERE qr_token=:token AND status='active'
 * Returns ticket info on success, error on duplicate/invalid.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { qr_token, scanned_by } = await req.json();

    if (!qr_token) {
      return new Response(
        JSON.stringify({ error: "Missing qr_token" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Atomic update: only succeeds if ticket is active
    const { data: ticket, error } = await supabase
      .from("tickets")
      .update({
        status: "scanned",
        checked_in_at: new Date().toISOString(),
        checked_in_by: scanned_by || null,
      })
      .eq("qr_token", qr_token)
      .eq("status", "active")
      .select(
        "id, event_id, ticket_type_id, user_id, status, qr_token, checked_in_at, purchase_amount_cents",
      )
      .single();

    if (error || !ticket) {
      // Check if ticket exists but isn't active
      const { data: existing } = await supabase
        .from("tickets")
        .select("id, status, checked_in_at")
        .eq("qr_token", qr_token)
        .single();

      if (existing) {
        const reason =
          existing.status === "scanned"
            ? "already_scanned"
            : existing.status === "refunded"
              ? "refunded"
              : "invalid_status";

        return new Response(
          JSON.stringify({
            valid: false,
            reason,
            status: existing.status,
            checked_in_at: existing.checked_in_at,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

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

    return new Response(
      JSON.stringify({
        valid: true,
        ticket: {
          ...ticket,
          username: user?.username || "Unknown",
          name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Guest",
          tier_name: ticketType?.name || "General",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[ticket-scan] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
