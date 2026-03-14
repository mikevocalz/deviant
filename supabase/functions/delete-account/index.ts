/**
 * Delete Account Edge Function
 *
 * POST /delete-account
 * Body: { confirm: true }
 *
 * Permanently deletes the authenticated user's account:
 *   1. Cancels active Stripe subscriptions
 *   2. Anonymizes financial records (orders, payouts) — required for bookkeeping
 *   3. Deletes social content (posts, comments, stories, follows)
 *   4. Deletes tickets, transfers, holds
 *   5. Deletes organizer data (branding, connect account)
 *   6. Deletes Stripe customer
 *   7. Anonymizes the users row
 *   8. Deletes Better Auth sessions + user record
 *
 * Apple App Store requires account deletion capability.
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
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

async function stripePost(
  endpoint: string,
  body: Record<string, string>,
): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

async function stripeGet(endpoint: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    const userId = await verifySession(supabase, req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return errorResponse(
        "Must send { confirm: true } to delete account",
        400,
      );
    }

    console.log(`[delete-account] Starting deletion for user ${userId}`);
    const deletedAt = new Date().toISOString();
    const anonymizedId = `deleted_${userId.slice(0, 8)}`;

    // ── 1. Cancel active Stripe subscriptions ─────────────────
    if (STRIPE_SECRET_KEY) {
      try {
        const { data: stripeCustomer } = await supabase
          .from("stripe_customers")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .single();

        if (stripeCustomer?.stripe_customer_id) {
          // List active subscriptions
          const subs = await stripeGet(
            `/subscriptions?customer=${stripeCustomer.stripe_customer_id}&status=active`,
          );

          for (const sub of subs.data || []) {
            await stripePost(`/subscriptions/${sub.id}`, {
              cancel_at_period_end: "false",
              // Immediate cancel
            });
            // Actually cancel immediately
            await fetch(
              `https://api.stripe.com/v1/subscriptions/${sub.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                },
              },
            );
            console.log(`[delete-account] Cancelled subscription ${sub.id}`);
          }

          // Delete the Stripe customer (removes payment methods, etc.)
          await fetch(
            `https://api.stripe.com/v1/customers/${stripeCustomer.stripe_customer_id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
              },
            },
          );
          console.log(
            `[delete-account] Deleted Stripe customer ${stripeCustomer.stripe_customer_id}`,
          );
        }
      } catch (err) {
        console.error("[delete-account] Stripe cleanup error:", err);
        // Continue with account deletion even if Stripe fails
      }
    }

    // ── 2. Cancel active Sneaky Lynk subscriptions in DB ──────
    await supabase
      .from("sneaky_subscriptions")
      .update({ status: "canceled", updated_at: deletedAt })
      .eq("host_id", userId)
      .in("status", ["active", "trialing", "past_due"]);

    // ── 3. Anonymize financial records (keep for bookkeeping) ─
    // Orders: anonymize user_id but keep financial data intact
    await supabase
      .from("orders")
      .update({ user_id: anonymizedId, updated_at: deletedAt })
      .eq("user_id", userId);

    // Refund requests: anonymize
    await supabase
      .from("refund_requests")
      .update({ user_id: anonymizedId })
      .eq("user_id", userId);

    // Payouts: anonymize host_id
    await supabase
      .from("payouts")
      .update({ host_id: anonymizedId })
      .eq("host_id", userId);

    // ── 4. Delete tickets and related data ────────────────────
    // Cancel pending transfers involving this user
    await supabase
      .from("ticket_transfers")
      .update({ status: "cancelled", resolved_at: deletedAt })
      .eq("from_user_id", userId)
      .eq("status", "pending");

    await supabase
      .from("ticket_transfers")
      .update({ status: "cancelled", resolved_at: deletedAt })
      .eq("to_user_id", userId)
      .eq("status", "pending");

    // Void all tickets
    await supabase
      .from("tickets")
      .update({ status: "void", user_id: anonymizedId })
      .eq("user_id", userId);

    // Expire active holds
    await supabase
      .from("ticket_holds")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "active");

    // ── 5. Delete social content ──────────────────────────────
    // Delete comments (before posts, since comments may reference posts)
    await supabase.from("comments").delete().eq("user_id", userId);

    // Delete comment likes
    await supabase.from("comment_likes").delete().eq("user_id", userId);

    // Delete post likes
    await supabase.from("likes").delete().eq("user_id", userId);

    // Delete event likes
    await supabase.from("event_likes").delete().eq("user_id", userId);

    // Delete posts (cascade will handle post_media, post_tags)
    await supabase.from("posts").delete().eq("user_id", userId);

    // Delete stories
    await supabase.from("stories").delete().eq("user_id", userId);

    // Delete follows (both directions)
    await supabase.from("follows").delete().eq("follower_id", userId);
    await supabase.from("follows").delete().eq("following_id", userId);

    // Delete blocks (both directions)
    await supabase.from("blocks").delete().eq("blocker_id", userId);
    await supabase.from("blocks").delete().eq("blocked_id", userId);

    // Delete notifications
    await supabase.from("notifications").delete().eq("user_id", userId);
    await supabase.from("notifications").delete().eq("actor_id", userId);

    // Delete event RSVPs
    await supabase.from("event_rsvps").delete().eq("user_id", userId);

    // Delete event reviews
    await supabase.from("event_reviews").delete().eq("user_id", userId);

    // ── 6. Delete video/room data ─────────────────────────────
    // Leave active rooms
    await supabase
      .from("video_room_members")
      .update({ status: "left" })
      .eq("user_id", userId)
      .eq("status", "active");

    // Delete room tokens
    await supabase
      .from("video_room_tokens")
      .delete()
      .eq("user_id", userId);

    // ── 7. Delete organizer data ──────────────────────────────
    // Cancel active promotion campaigns
    await supabase
      .from("event_spotlight_campaigns")
      .update({ status: "cancelled" })
      .eq("organizer_id", userId)
      .in("status", ["active", "pending"]);

    // Delete organizer branding
    await supabase
      .from("organizer_branding")
      .delete()
      .eq("host_id", userId);

    // Note: organizer_accounts row kept (Stripe Connect account persists for payout history)
    // but anonymize the host_id
    await supabase
      .from("organizer_accounts")
      .update({ host_id: anonymizedId, updated_at: deletedAt })
      .eq("host_id", userId);

    // ── 8. Delete Stripe customer mapping ─────────────────────
    await supabase
      .from("stripe_customers")
      .delete()
      .eq("user_id", userId);

    // Delete sneaky customers mapping
    await supabase
      .from("sneaky_customers")
      .delete()
      .eq("user_id", userId);

    // ── 9. Delete user settings ───────────────────────────────
    await supabase
      .from("user_settings")
      .delete()
      .eq("user_id", userId);

    // ── 10. Delete verification requests ──────────────────────
    await supabase
      .from("verification_requests")
      .delete()
      .eq("user_id", userId);

    // ── 11. Anonymize the users row ───────────────────────────
    await supabase
      .from("users")
      .update({
        username: anonymizedId,
        email: `${anonymizedId}@deleted.local`,
        first_name: "Deleted",
        last_name: "User",
        bio: null,
        avatar_url: null,
        location: null,
        website: null,
        links: null,
        verified: false,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        updated_at: deletedAt,
      })
      .eq("auth_id", userId);

    // ── 12. Delete call signals ───────────────────────────────
    await supabase
      .from("call_signals")
      .delete()
      .eq("caller_id", userId);
    await supabase
      .from("call_signals")
      .delete()
      .eq("callee_id", userId);

    // ── 13. Delete Better Auth sessions + account ─────────────
    // Delete all sessions for this user
    await supabase.from("session").delete().eq("userId", userId);

    // Delete Better Auth accounts (social logins)
    await supabase.from("account").delete().eq("userId", userId);

    // Delete Better Auth user record
    await supabase.from("user").delete().eq("id", userId);

    console.log(`[delete-account] Account deletion complete for ${userId}`);

    return jsonResponse({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (err: any) {
    console.error("[delete-account] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
