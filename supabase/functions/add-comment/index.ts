/**
 * Edge Function: add-comment
 * Add a comment to a post with Better Auth verification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
  console.error(`[Edge:add-comment] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

serve(async (req: Request) => {
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

    let body: { postId: number; content: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { postId, content } = body;
    if (!postId || typeof postId !== "number") {
      return errorResponse(
        "validation_error",
        "postId is required and must be a number",
        400,
      );
    }
    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return errorResponse("validation_error", "content is required");
    }

    // Get user's integer ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, username, first_name, avatar:avatar_id(url)")
      .eq("auth_id", authUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found");
    }

    const userId = userData.id;
    console.log("[Edge:add-comment] User:", userId, "Post:", postId);

    // Insert comment
    const { data: comment, error: insertError } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: postId,
        author_id: userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Edge:add-comment] Insert error:", insertError);
      return errorResponse("internal_error", "Failed to add comment");
    }

    // Increment comments count on post
    await supabaseAdmin.rpc("increment_post_comments", { post_id: postId });

    console.log("[Edge:add-comment] Comment added:", comment.id);

    // --- Notifications ---

    // 1. Notify post author about the comment (unless they're the commenter)
    try {
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .single();

      if (post && post.author_id && post.author_id !== userId) {
        await supabaseAdmin.from("notifications").insert({
          recipient_id: post.author_id,
          actor_id: userId,
          type: "comment",
          entity_type: "post",
          entity_id: String(postId),
        });
        console.log(
          "[Edge:add-comment] Comment notification sent to post author:",
          post.author_id,
        );
      }
    } catch (notifErr) {
      console.error("[Edge:add-comment] Comment notification error:", notifErr);
    }

    // 2. Parse @mentions and notify mentioned users
    try {
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        if (!mentions.includes(match[1])) mentions.push(match[1]);
      }

      if (mentions.length > 0) {
        console.log("[Edge:add-comment] Found mentions:", mentions);

        // Look up mentioned users by username
        const { data: mentionedUsers } = await supabaseAdmin
          .from("users")
          .select("id, username")
          .in("username", mentions);

        if (mentionedUsers && mentionedUsers.length > 0) {
          const notifications = mentionedUsers
            .filter((u: any) => u.id !== userId) // Don't notify yourself
            .map((u: any) => ({
              recipient_id: u.id,
              actor_id: userId,
              type: "mention",
              entity_type: "post",
              entity_id: String(postId),
            }));

          if (notifications.length > 0) {
            await supabaseAdmin.from("notifications").insert(notifications);
            console.log(
              "[Edge:add-comment] Mention notifications sent:",
              notifications.length,
            );
          }
        }
      }
    } catch (mentionErr) {
      console.error(
        "[Edge:add-comment] Mention notification error:",
        mentionErr,
      );
    }

    return jsonResponse({
      ok: true,
      data: {
        comment: {
          id: String(comment.id),
          postId: String(comment.post_id),
          content: comment.content,
          createdAt: comment.created_at,
          author: {
            id: String(userData.id),
            username: userData.username,
            name: userData.first_name || userData.username,
            avatar: (userData.avatar as any)?.url || null,
          },
        },
      },
    });
  } catch (err) {
    console.error("[Edge:add-comment] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
