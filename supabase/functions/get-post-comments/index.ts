/**
 * Edge Function: get-post-comments
 * Fetch comments for a post with nested replies up to depth 2.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrProvisionUser } from "../_shared/resolve-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

interface CommentNode {
  id: string;
  postId: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  hasLiked: boolean;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  replies: CommentNode[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const postId = body?.postId != null ? Number(body.postId) : NaN;
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 100);

    if (!Number.isFinite(postId) || postId <= 0) {
      return json({ error: "Invalid postId" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Server configuration error" }, 500);
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

    const { data: rootComments, error: rootError } = await supabaseAdmin
      .from("comments")
      .select(
        "id, post_id, content, likes_count, created_at, parent_id, root_id, depth, author:author_id(id, username, first_name, avatar:avatar_id(url))",
      )
      .eq("post_id", postId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (rootError) {
      console.error("[Edge:get-post-comments] root query error:", rootError);
      return json({ error: rootError.message }, 500);
    }

    const rootIds = (rootComments || []).map((comment: any) => comment.id);
    const { data: replyComments, error: replyError } = rootIds.length
      ? await supabaseAdmin
          .from("comments")
          .select(
            "id, post_id, content, likes_count, created_at, parent_id, root_id, depth, author:author_id(id, username, first_name, avatar:avatar_id(url))",
          )
          .eq("post_id", postId)
          .in("root_id", rootIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (replyError) {
      console.error("[Edge:get-post-comments] reply query error:", replyError);
      return json({ error: replyError.message }, 500);
    }

    const allRows = [...(rootComments || []), ...(replyComments || [])];
    const allIds = allRows.map((row: any) => row.id);

    let likedCommentIds = new Set<number>();
    if (viewerId && allIds.length > 0) {
      const { data: likesData } = await supabaseAdmin
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", allIds)
        .eq("user_id", viewerId);
      likedCommentIds = new Set(
        (likesData || []).map((row: any) => row.comment_id),
      );
    }

    const toNode = (row: any): CommentNode => ({
      id: String(row.id),
      postId: String(row.post_id),
      username: row.author?.username || "unknown",
      avatar: row.author?.avatar?.url || "",
      text: row.content || "",
      timeAgo: formatTimeAgo(row.created_at),
      likes: Number(row.likes_count) || 0,
      hasLiked: viewerId ? likedCommentIds.has(row.id) : false,
      parentId: row.parent_id != null ? String(row.parent_id) : null,
      rootId: row.root_id != null ? String(row.root_id) : null,
      depth: Number(row.depth) || 0,
      replies: [],
    });

    const nodeMap = new Map<string, CommentNode>();
    for (const row of allRows) {
      const node = toNode(row);
      nodeMap.set(node.id, node);
    }

    const roots: CommentNode[] = [];
    for (const row of rootComments || []) {
      const root = nodeMap.get(String(row.id));
      if (root) roots.push(root);
    }

    for (const row of replyComments || []) {
      const node = nodeMap.get(String(row.id));
      if (!node) continue;
      const parentId = row.parent_id != null ? String(row.parent_id) : null;
      if (!parentId) continue;
      const parent = nodeMap.get(parentId);
      if (!parent) continue;
      parent.replies.push(node);
    }

    return json({ comments: roots });
  } catch (err) {
    console.error("[Edge:get-post-comments] Unexpected error:", err);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
