/**
 * Transfer Ticket Edge Function
 *
 * POST /transfer-ticket
 * Actions:
 *   { action: "initiate", ticket_id, to_username }
 *   { action: "accept", transfer_id }
 *   { action: "decline", transfer_id }
 *   { action: "cancel", transfer_id }
 *
 * Transfers a ticket from one user to another with a 24h expiry.
 * - Initiate: creates a pending transfer, marks ticket as "transfer_pending"
 * - Accept: reassigns ticket to recipient, generates new QR token
 * - Decline/Cancel: reverts ticket to active
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySession } from "../_shared/verify-session.ts";
import { createSignedQrPayload } from "../_shared/hmac-qr.ts";
import { voidWalletPass } from "../_shared/wallet-push.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    const userId = await verifySession(supabase, req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { action, ticket_id, to_username, transfer_id } = await req.json();

    // ══════════════════════════════════════════════════════════
    // INITIATE TRANSFER
    // ══════════════════════════════════════════════════════════
    if (action === "initiate") {
      if (!ticket_id || !to_username) {
        return json({ error: "ticket_id and to_username required" }, 400);
      }

      // Verify ticket ownership
      const { data: ticket, error: ticketErr } = await supabase
        .from("tickets")
        .select("id, user_id, event_id, status")
        .eq("id", ticket_id)
        .single();

      if (ticketErr || !ticket) return json({ error: "Ticket not found" }, 404);
      if (ticket.user_id !== userId) {
        return json({ error: "You don't own this ticket" }, 403);
      }
      if (ticket.status !== "active") {
        return json(
          { error: `Cannot transfer ticket with status "${ticket.status}"` },
          400,
        );
      }

      // Check no pending transfer exists for this ticket
      const { data: existingTransfer } = await supabase
        .from("ticket_transfers")
        .select("id")
        .eq("ticket_id", ticket_id)
        .eq("status", "pending")
        .single();

      if (existingTransfer) {
        return json(
          { error: "This ticket already has a pending transfer" },
          409,
        );
      }

      // Resolve recipient by username
      const { data: recipient } = await supabase
        .from("user")
        .select("id")
        .eq("username", to_username.toLowerCase())
        .single();

      if (!recipient) {
        return json({ error: "User not found" }, 404);
      }

      if (recipient.id === userId) {
        return json({ error: "Cannot transfer to yourself" }, 400);
      }

      // Check recipient doesn't already have a ticket for this event
      const { data: recipientTicket } = await supabase
        .from("tickets")
        .select("id")
        .eq("event_id", ticket.event_id)
        .eq("user_id", recipient.id)
        .in("status", ["active", "scanned"])
        .limit(1)
        .single();

      if (recipientTicket) {
        return json(
          { error: "This user already has a ticket for this event" },
          409,
        );
      }

      // Mark ticket as transfer_pending to prevent scanning
      await supabase
        .from("tickets")
        .update({ status: "transfer_pending" })
        .eq("id", ticket_id);

      // Void sender's wallet pass (if any)
      await voidWalletPass(supabase, ticket_id);

      // Create transfer record
      const { data: transfer, error: createErr } = await supabase
        .from("ticket_transfers")
        .insert({
          ticket_id,
          from_user_id: userId,
          to_user_id: recipient.id,
          status: "pending",
        })
        .select("id, expires_at")
        .single();

      if (createErr) throw createErr;

      console.log(
        `[transfer-ticket] Transfer initiated: ${ticket_id} from ${userId} to ${recipient.id}`,
      );

      return json({
        transfer_id: transfer.id,
        expires_at: transfer.expires_at,
      });
    }

    // ══════════════════════════════════════════════════════════
    // ACCEPT TRANSFER
    // ══════════════════════════════════════════════════════════
    if (action === "accept") {
      if (!transfer_id) return json({ error: "transfer_id required" }, 400);

      const { data: transfer, error: tErr } = await supabase
        .from("ticket_transfers")
        .select("*, tickets(id, user_id, event_id, status)")
        .eq("id", transfer_id)
        .single();

      if (tErr || !transfer) return json({ error: "Transfer not found" }, 404);

      const ticket = (transfer as any).tickets;
      if (!ticket) return json({ error: "Associated ticket not found" }, 404);

      if (transfer.to_user_id !== userId) {
        return json({ error: "This transfer is not for you" }, 403);
      }
      if (transfer.status !== "pending") {
        return json({ error: `Transfer is ${transfer.status}` }, 400);
      }
      if (new Date(transfer.expires_at) < new Date()) {
        // Auto-expire and revert ticket to active
        await supabase
          .from("ticket_transfers")
          .update({ status: "expired", resolved_at: new Date().toISOString() })
          .eq("id", transfer_id);
        await supabase
          .from("tickets")
          .update({ status: "active" })
          .eq("id", ticket.id);
        return json({ error: "Transfer has expired" }, 400);
      }

      // Atomically claim the transfer (prevents concurrent accept race)
      const { data: claimed, error: claimErr } = await supabase
        .from("ticket_transfers")
        .update({ status: "accepted", resolved_at: new Date().toISOString() })
        .eq("id", transfer_id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (claimErr || !claimed) {
        return json({ error: "Transfer already processed" }, 409);
      }

      // Generate new HMAC-signed QR token for security
      const { qrToken, qrPayload } = await createSignedQrPayload(
        ticket.id,
        ticket.event_id,
      );

      // Reassign ticket to recipient and reactivate
      // Clear wallet fields so new owner gets a fresh pass
      const { error: updateErr } = await supabase
        .from("tickets")
        .update({
          user_id: userId,
          status: "active",
          qr_token: qrToken,
          qr_payload: qrPayload,
          transferred_from: transfer.from_user_id,
          wallet_serial_number: null,
          wallet_auth_token: null,
          wallet_pass_type_id: null,
          wallet_voided_at: null,
          wallet_last_pushed_at: null,
        })
        .eq("id", ticket.id);

      if (updateErr) throw updateErr;

      console.log(
        `[transfer-ticket] Transfer accepted: ${ticket.id} now owned by ${userId}`,
      );

      return json({
        success: true,
        ticket_id: ticket.id,
        qr_token: qrToken,
      });
    }

    // ══════════════════════════════════════════════════════════
    // DECLINE TRANSFER (recipient declines)
    // ══════════════════════════════════════════════════════════
    if (action === "decline") {
      if (!transfer_id) return json({ error: "transfer_id required" }, 400);

      const { data: transfer } = await supabase
        .from("ticket_transfers")
        .select("id, to_user_id, ticket_id, status")
        .eq("id", transfer_id)
        .single();

      if (!transfer) return json({ error: "Transfer not found" }, 404);
      if (transfer.to_user_id !== userId) {
        return json({ error: "This transfer is not for you" }, 403);
      }
      if (transfer.status !== "pending") {
        return json({ error: `Transfer is ${transfer.status}` }, 400);
      }

      // Atomically claim decline (prevents race with concurrent accept)
      const { data: declined, error: declineErr } = await supabase
        .from("ticket_transfers")
        .update({ status: "declined", resolved_at: new Date().toISOString() })
        .eq("id", transfer_id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (declineErr || !declined) {
        return json({ error: "Transfer already processed" }, 409);
      }

      // Revert ticket to active so sender can use it
      await supabase
        .from("tickets")
        .update({ status: "active" })
        .eq("id", transfer.ticket_id);

      console.log(`[transfer-ticket] Transfer declined: ${transfer_id}`);

      return json({ success: true });
    }

    // ══════════════════════════════════════════════════════════
    // CANCEL TRANSFER (sender cancels)
    // ══════════════════════════════════════════════════════════
    if (action === "cancel") {
      if (!transfer_id) return json({ error: "transfer_id required" }, 400);

      const { data: transfer } = await supabase
        .from("ticket_transfers")
        .select("id, from_user_id, ticket_id, status")
        .eq("id", transfer_id)
        .single();

      if (!transfer) return json({ error: "Transfer not found" }, 404);
      if (transfer.from_user_id !== userId) {
        return json({ error: "Only the sender can cancel" }, 403);
      }
      if (transfer.status !== "pending") {
        return json({ error: `Transfer is ${transfer.status}` }, 400);
      }

      // Atomically claim cancel (prevents race with concurrent accept)
      const { data: cancelled, error: cancelErr } = await supabase
        .from("ticket_transfers")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", transfer_id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (cancelErr || !cancelled) {
        return json({ error: "Transfer already processed" }, 409);
      }

      // Revert ticket to active so sender can use it
      await supabase
        .from("tickets")
        .update({ status: "active" })
        .eq("id", transfer.ticket_id);

      console.log(`[transfer-ticket] Transfer cancelled: ${transfer_id}`);

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err: any) {
    console.error("[transfer-ticket] Error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
