/**
 * Edge Function: get-post-comments
 * Fetch comments for a post with author + hasLiked. Uses service role to bypass RLS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrProvisionUser } from "../_shared/resolve-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

interface CommentRow {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  hasLiked: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const postId = body?.postId != null ? String(body.postId) : null;
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 100);
    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const postIdInt = parseInt(postId);
    if (isNaN(postIdInt)) {
      return new Response(JSON.stringify({ error: "Invalid postId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    let viewerId: number | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: sessionData } = await supabaseAdmin
        .from("session")
        .select("userId, expiresAt")
        .eq("token", token)
        .single();
      if (sessionData && new Date(sessionData.expiresAt) >= new Date()) {
        const userData = await resolveOrProvisionUser(
          supabaseAdmin,
          sessionData.userId,
          "id",
        );
        viewerId = userData?.id ?? null;
      }
    }

    const { data: commentsData, error } = await supabaseAdmin
      .from("comments")
      .select(
        `id, content, likes_count, created_at, author:author_id(id, username, first_name, avatar:avatar_id(url))`,
      )
      .eq("post_id", postIdInt)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Edge:get-post-comments] Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commentIds = (commentsData || []).map((c: any) => c.id);
    let likedCommentIds = new Set<number>();
    if (viewerId && commentIds.length > 0) {
      const { data: likesData } = await supabaseAdmin
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", commentIds)
        .eq("user_id", viewerId);
      likedCommentIds = new Set(
        (likesData || []).map((l: any) => l.comment_id),
      );
    }

    const comments: CommentRow[] = (commentsData || []).map((c: any) => ({
      id: String(c.id),
      username: c.author?.username || "unknown",
      avatar: c.author?.avatar?.url || "",
      text: c.content || "",
      timeAgo: formatTimeAgo(c.created_at),
      likes: Number(c.likes_count) || 0,
      hasLiked: viewerId ? likedCommentIds.has(c.id) : false,
    }));

    return new Response(JSON.stringify({ comments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Edge:get-post-comments] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
