/**
 * Edge Function: toggle-follow
 * Follow/unfollow a user with Better Auth verification
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string): Response {
  console.error(`[Edge:toggle-follow] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        "unauthorized",
        "Missing or invalid Authorization header",
        401,
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    // Verify Better Auth session via direct DB lookup
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !sessionData) {
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    if (new Date(sessionData.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const authUserId = sessionData.userId;
    console.log(
      "[Edge:toggle-follow] authUserId from session:",
      authUserId,
      "type:",
      typeof authUserId,
    );

    let body: { targetUserId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { targetUserId } = body;
    if (!targetUserId || typeof targetUserId !== "number") {
      return errorResponse(
        "validation_error",
        "targetUserId is required and must be a number",
        400,
      );
    }

    // Get user's integer ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUserId)
      .single();

    if (userError || !userData) {
      console.error(
        "[Edge:toggle-follow] User lookup failed — authUserId:",
        authUserId,
        "error:",
        userError?.message,
        "code:",
        userError?.code,
      );
      // Fallback: try looking up by email from Better Auth user table
      const { data: baUser } = await supabaseAdmin
        .from("user")
        .select("id, email")
        .eq("id", authUserId)
        .single();
      console.error(
        "[Edge:toggle-follow] Better Auth user row:",
        baUser ? { id: baUser.id, email: baUser.email } : "NOT FOUND",
      );
      return errorResponse("not_found", "User not found");
    }

    const userId = userData.id;

    // Can't follow yourself
    if (userId === targetUserId) {
      return errorResponse("validation_error", "Cannot follow yourself");
    }

    console.log("[Edge:toggle-follow] User:", userId, "Target:", targetUserId);

    // Check if already following
    const { data: existingFollow } = await supabaseAdmin
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("following_id", targetUserId)
      .single();

    let following: boolean;

    if (existingFollow) {
      // Unfollow
      const { error: deleteError } = await supabaseAdmin
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", targetUserId);

      if (deleteError) {
        console.error("[Edge:toggle-follow] Delete error:", deleteError);
        return errorResponse("internal_error", "Failed to unfollow");
      }

      // Update counts
      await supabaseAdmin.rpc("decrement_following_count", { user_id: userId });
      await supabaseAdmin.rpc("decrement_followers_count", {
        user_id: targetUserId,
      });
      following = false;
    } else {
      // Follow
      const { error: insertError } = await supabaseAdmin
        .from("follows")
        .insert({ follower_id: userId, following_id: targetUserId });

      if (insertError) {
        console.error("[Edge:toggle-follow] Insert error:", insertError);
        return errorResponse("internal_error", "Failed to follow");
      }

      // Update counts
      await supabaseAdmin.rpc("increment_following_count", { user_id: userId });
      await supabaseAdmin.rpc("increment_followers_count", {
        user_id: targetUserId,
      });
      following = true;

      // ── Send follow notification to target user (fire-and-forget) ──
      try {
        // Get follower's username for the notification message
        const { data: followerData } = await supabaseAdmin
          .from("users")
          .select("username, avatar_id(url)")
          .eq("id", userId)
          .single();

        const followerUsername = followerData?.username || "Someone";
        const followerAvatar = (followerData?.avatar_id as any)?.url || "";

        // 1. Insert into notifications table
        await supabaseAdmin.from("notifications").insert({
          recipient_id: targetUserId,
          actor_id: userId,
          type: "follow",
          entity_type: "user",
          entity_id: String(userId),
        });

        // 2. Send Expo push notification
        const { data: tokens } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .eq("user_id", targetUserId);

        if (tokens && tokens.length > 0) {
          const messages = tokens.map((t: { token: string }) => ({
            to: t.token,
            title: "New Follower",
            body: `${followerUsername} started following you`,
            data: {
              type: "follow",
              senderId: String(userId),
              senderUsername: followerUsername,
              senderAvatar: followerAvatar,
              entityType: "user",
              entityId: String(userId),
            },
            sound: "default",
            channelId: "default",
          }));

          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(messages),
          });
          console.log(
            "[Edge:toggle-follow] Push notification sent to",
            tokens.length,
            "device(s)",
          );
        }
      } catch (notifErr) {
        // Don't fail the follow if notification fails
        console.error(
          "[Edge:toggle-follow] Notification error (non-fatal):",
          notifErr,
        );
      }
    }

    console.log("[Edge:toggle-follow] Result:", { following });

    return jsonResponse({
      ok: true,
      data: { following },
    });
  } catch (err) {
    console.error("[Edge:toggle-follow] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
