/**
 * Edge Function: delete-comment
 * Delete a comment with Better Auth verification
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
  console.error(`[Edge:delete-comment] Error: ${code} - ${message}`);
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

    let body: { commentId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { commentId } = body;
    if (!commentId || typeof commentId !== "number") {
      return errorResponse("validation_error", "commentId is required and must be a number", 400);
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

    // Get comment to verify ownership and get post_id
    const { data: comment, error: commentError } = await supabaseAdmin
      .from("comments")
      .select("id, author_id, post_id")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return errorResponse("not_found", "Comment not found", 404);
    }

    // Verify ownership
    if (comment.author_id !== userId) {
      return errorResponse("forbidden", "You can only delete your own comments", 403);
    }

    console.log("[Edge:delete-comment] User:", userId, "Comment:", commentId);

    // Delete comment
    const { error: deleteError } = await supabaseAdmin
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (deleteError) {
      console.error("[Edge:delete-comment] Delete error:", deleteError);
      return errorResponse("internal_error", "Failed to delete comment", 500);
    }

    // Decrement comments count on post
    await supabaseAdmin.rpc("decrement_post_comments", { post_id: comment.post_id });

    console.log("[Edge:delete-comment] Comment deleted:", commentId);

    return jsonResponse({
      ok: true,
      data: { success: true },
    });
  } catch (err) {
    console.error("[Edge:delete-comment] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
