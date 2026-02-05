/**
 * Edge Function: toggle-follow
 * Follow/unfollow a user with Better Auth verification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function errorResponse(code: string, message: string, status = 400): Response {
  console.error(`[Edge:toggle-follow] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(token: string): Promise<{ odUserId: string } | null> {
  const betterAuthUrl = Deno.env.get("BETTER_AUTH_BASE_URL");
  if (!betterAuthUrl) return null;

  try {
    const response = await fetch(`${betterAuthUrl}/api/auth/get-session`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.user?.id) return null;
    return { odUserId: data.user.id };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const session = await verifyBetterAuthSession(token);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session", 401);
    }

    const { odUserId } = session;

    let body: { targetUserId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { targetUserId } = body;
    if (!targetUserId || typeof targetUserId !== "number") {
      return errorResponse("validation_error", "targetUserId is required and must be a number", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's integer ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found", 404);
    }

    const userId = userData.id;

    // Can't follow yourself
    if (userId === targetUserId) {
      return errorResponse("validation_error", "Cannot follow yourself", 400);
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
        return errorResponse("internal_error", "Failed to unfollow", 500);
      }

      // Update counts
      await supabaseAdmin.rpc("decrement_following_count", { user_id: userId });
      await supabaseAdmin.rpc("decrement_followers_count", { user_id: targetUserId });
      following = false;
    } else {
      // Follow
      const { error: insertError } = await supabaseAdmin
        .from("follows")
        .insert({ follower_id: userId, following_id: targetUserId });

      if (insertError) {
        console.error("[Edge:toggle-follow] Insert error:", insertError);
        return errorResponse("internal_error", "Failed to follow", 500);
      }

      // Update counts
      await supabaseAdmin.rpc("increment_following_count", { user_id: userId });
      await supabaseAdmin.rpc("increment_followers_count", { user_id: targetUserId });
      following = true;
    }

    console.log("[Edge:toggle-follow] Result:", { following });

    return jsonResponse({
      ok: true,
      data: { following },
    });
  } catch (err) {
    console.error("[Edge:toggle-follow] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
