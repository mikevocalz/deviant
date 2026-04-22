/**
 * Edge Function: get-bookmarks
 *
 * Fetch the current user's bookmarked posts. Uses service role (bypasses RLS).
 * Auth required — validates the Better Auth session token.
 *
 * Request body:
 *   {}                         — default: returns just { postIds: string[] }
 *   { withPosts: true }        — returns { postIds, posts } where posts is
 *                                 an array of hydrated post rows ready to
 *                                 feed into transformPost() on the client.
 *                                 Used by the profile "Saved" tab to avoid
 *                                 the 1 + N waterfall (get IDs, then N
 *                                 parallel getPostById calls).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    // Parse optional request body — { withPosts?: boolean }
    let body: { withPosts?: boolean } = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // Empty or invalid body is fine — default to postIds only
    }
    const withPosts = body.withPosts === true;

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

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !sessionData) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(sessionData.expiresAt) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authId = sessionData.userId;
    const { data, error } = await supabaseAdmin
      .from("bookmarks")
      .select("post_id, created_at")
      .eq("user_id", authId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Edge:get-bookmarks] Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postIds = (data || []).map((b: any) => String(b.post_id));

    if (!withPosts || postIds.length === 0) {
      return new Response(JSON.stringify({ postIds, posts: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hydrate posts in one query — join author + media so the client
    // can run transformPost() with no extra round trips.
    const numericPostIds = postIds
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n));

    const { data: posts, error: postsError } = await supabaseAdmin
      .from("posts")
      .select(
        `
        *,
        author:users!posts_author_id_users_id_fk(
          id,
          username,
          first_name,
          verified,
          avatar:avatar_id(url)
        ),
        media:posts_media(
          type,
          url,
          _order,
          mime_type,
          live_photo_video_url
        )
      `,
      )
      .in("id", numericPostIds);

    if (postsError) {
      console.error("[Edge:get-bookmarks] posts join error:", postsError);
      // Fall back to postIds-only so the client can still waterfall if needed
      return new Response(JSON.stringify({ postIds, posts: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preserve bookmark creation order (DESC by bookmark.created_at)
    const orderIndex = new Map<string, number>();
    postIds.forEach((id, idx) => orderIndex.set(String(id), idx));
    const orderedPosts = (posts || [])
      .slice()
      .sort((a: any, b: any) => {
        const ai = orderIndex.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });

    return new Response(
      JSON.stringify({ postIds, posts: orderedPosts }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[Edge:get-bookmarks] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
