/**
 * Edge Function: toggle-like
 * Toggle like on a post with Better Auth verification
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
  console.error(`[Edge:toggle-like] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(token: string): Promise<{ odUserId: string; email: string } | null> {
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
    return { odUserId: data.user.id, email: data.user.email || "" };
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
    console.log("[Edge:toggle-like] Authenticated user auth_id:", odUserId);

    // Parse body
    let body: { postId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { postId } = body;
    if (!postId || typeof postId !== "number") {
      return errorResponse("validation_error", "postId is required and must be a number", 400);
    }

    // Get Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error", 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's integer ID from auth_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      console.error("[Edge:toggle-like] User not found:", userError);
      return errorResponse("not_found", "User not found", 404);
    }

    const userId = userData.id;
    console.log("[Edge:toggle-like] User ID:", userId, "Post ID:", postId);

    // Check if already liked
    const { data: existingLike } = await supabaseAdmin
      .from("likes")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .single();

    let liked: boolean;
    
    if (existingLike) {
      // Unlike - delete the like
      const { error: deleteError } = await supabaseAdmin
        .from("likes")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", postId);

      if (deleteError) {
        console.error("[Edge:toggle-like] Delete error:", deleteError);
        return errorResponse("internal_error", "Failed to unlike", 500);
      }

      // Decrement likes count
      await supabaseAdmin.rpc("decrement_post_likes", { post_id: postId });
      liked = false;
    } else {
      // Like - insert new like
      const { error: insertError } = await supabaseAdmin
        .from("likes")
        .insert({ user_id: userId, post_id: postId });

      if (insertError) {
        console.error("[Edge:toggle-like] Insert error:", insertError);
        return errorResponse("internal_error", "Failed to like", 500);
      }

      // Increment likes count
      await supabaseAdmin.rpc("increment_post_likes", { post_id: postId });
      liked = true;
    }

    // Get updated likes count
    const { data: postData } = await supabaseAdmin
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .single();

    const likesCount = postData?.likes_count || 0;
    console.log("[Edge:toggle-like] Result:", { liked, likesCount });

    return jsonResponse({
      ok: true,
      data: { liked, likesCount },
    });
  } catch (err) {
    console.error("[Edge:toggle-like] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
