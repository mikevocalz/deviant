/**
 * Bootstrap Profile Edge Function
 *
 * POST /bootstrap-profile
 *
 * Returns ALL above-the-fold data for the profile screen in a single request:
 * - Profile header (username, bio, avatar, counts, verified)
 * - Relationship state (viewer following/followed-by)
 * - First page of posts (thumbnails for grid)
 *
 * Eliminates 6+ independent queries on the profile tab.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GRID_PAGE_SIZE = 18; // 6 rows x 3 columns = 2 screens worth

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const t0 = Date.now();

  try {
    const { user_id, viewer_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // Determine if this is own profile or another user's
    const isOwnProfile = !viewer_id || viewer_id === user_id;

    // ── Fire ALL queries in parallel ──────────────────────────────

    const queries: Promise<any>[] = [
      // 1. Profile data
      supabase
        .from("users")
        .select(
          `
          id, auth_id, username, first_name, bio, website, location,
          verified, followers_count, following_count, posts_count,
          avatar:avatar_id(url)
        `,
        )
        .eq("auth_id", user_id)
        .single(),

      // 2. First page of posts (grid thumbnails)
      supabase
        .from("posts")
        .select(
          `
          id, created_at, is_nsfw, likes_count,
          media:posts_media(type, url, "order")
        `,
        )
        .eq("author_id", user_id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(0, GRID_PAGE_SIZE - 1),
    ];

    // 3. Relationship state (only if viewing another user's profile)
    if (!isOwnProfile && viewer_id) {
      queries.push(
        supabase
          .from("follows")
          .select("id")
          .eq("follower_id", viewer_id)
          .eq("following_id", user_id)
          .maybeSingle(),
      );
      queries.push(
        supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user_id)
          .eq("following_id", viewer_id)
          .maybeSingle(),
      );
    }

    const results = await Promise.all(queries);

    const profileResult = results[0];
    const postsResult = results[1];
    const viewerFollowsResult = !isOwnProfile ? results[2] : null;
    const followsViewerResult = !isOwnProfile ? results[3] : null;

    if (profileResult.error || !profileResult.data) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Build response ─────────────────────────────────────────────

    const p = profileResult.data;
    const avatarUrl =
      typeof p.avatar === "object" ? p.avatar?.url : null;

    const posts = (postsResult.data || []).map((post: any) => {
      const media = (post.media || []).sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0),
      );
      const firstMedia = media[0];
      return {
        id: String(post.id),
        thumbnailUrl: firstMedia?.url || "",
        type: firstMedia?.type || "image",
        likesCount: post.likes_count || 0,
      };
    });

    const elapsed = Date.now() - t0;

    const response = {
      profile: {
        id: String(p.id),
        authId: p.auth_id,
        username: p.username || "",
        firstName: p.first_name || "",
        bio: p.bio || "",
        website: p.website || "",
        location: p.location || "",
        avatarUrl: avatarUrl || "",
        followersCount: p.followers_count || 0,
        followingCount: p.following_count || 0,
        postsCount: p.posts_count || 0,
        verified: p.verified || false,
        viewerIsFollowing: viewerFollowsResult?.data ? true : false,
        viewerIsFollowedBy: followsViewerResult?.data ? true : false,
      },
      posts,
      nextCursor: posts.length >= GRID_PAGE_SIZE ? GRID_PAGE_SIZE : null,
      hasMore: posts.length >= GRID_PAGE_SIZE,
      _meta: { elapsed, postCount: posts.length },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err: any) {
    console.error("[bootstrap-profile] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
