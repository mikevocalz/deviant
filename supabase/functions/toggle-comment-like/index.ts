/**
 * Edge Function: toggle-comment-like
 * Toggle like on a comment with Better Auth verification.
 * Bypasses RLS (auth.uid() is null with Better Auth) by using service role.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrProvisionUser } from "../_shared/resolve-user.ts";

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
  console.error(`[Edge:toggle-comment-like] Error: ${code} - ${message}`);
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
    console.log("[Edge:toggle-comment-like] Authenticated user:", authUserId);

    let body: { commentId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { commentId } = body;
    if (!commentId || typeof commentId !== "number") {
      return errorResponse(
        "validation_error",
        "commentId is required and must be a number",
      );
    }

    const userData = await resolveOrProvisionUser(
      supabaseAdmin,
      authUserId,
      "id",
    );
    if (!userData) return errorResponse("not_found", "User not found");

    const userId = userData.id;

    const { data: existing } = await supabaseAdmin
      .from("comment_likes")
      .select("user_id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      const { error: delErr } = await supabaseAdmin
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);

      if (delErr) {
        console.error("[Edge:toggle-comment-like] Delete error:", delErr);
        return errorResponse("internal_error", "Failed to unlike");
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("comment_likes")
        .insert({ comment_id: commentId, user_id: userId });

      if (insertErr) {
        console.error("[Edge:toggle-comment-like] Insert error:", insertErr);
        return errorResponse("internal_error", "Failed to like");
      }
    }

    const { data: commentData } = await supabaseAdmin
      .from("comments")
      .select("likes_count")
      .eq("id", commentId)
      .single();

    const likesCount = commentData?.likes_count ?? 0;
    const liked = !existing;

    return jsonResponse({
      ok: true,
      data: { liked, likesCount },
    });
  } catch (err) {
    console.error("[Edge:toggle-comment-like] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
