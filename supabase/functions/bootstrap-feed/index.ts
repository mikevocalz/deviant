/**
 * Bootstrap Feed Edge Function
 *
 * POST /bootstrap-feed
 *
 * Returns ALL above-the-fold data for the feed screen in a single request:
 * - Paginated feed posts (with author, media, viewer like/bookmark state)
 * - Stories row (users with unseen stories)
 * - Viewer context (unread messages, unread notifications badges)
 *
 * This eliminates the N-query waterfall on the feed screen.
 * Client falls back to individual queries if this fails.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAGE_SIZE = 20;

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
    const { user_id, cursor = 0, limit = PAGE_SIZE } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // ── Resolve integer users.id from auth_id UUID ────────────────
    // user_id from client is AppUser.id = Better Auth UUID, NOT integer
    let intUserId: number | null = null;
    const asInt = parseInt(user_id, 10);
    if (!isNaN(asInt) && String(asInt) === String(user_id)) {
      intUserId = asInt;
    } else {
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user_id)
        .single();
      intUserId = userRow?.id ?? null;
    }

    // ── Fire ALL queries in parallel — never sequential ──────────

    const [
      postsResult,
      viewerLikesResult,
      viewerBookmarksResult,
      storiesResult,
      unreadMessagesResult,
      unreadNotificationsResult,
      viewerProfileResult,
    ] = await Promise.all([
      // 1. Feed posts with author + media (single join query)
      supabase
        .from("posts")
        .select(
          `
          id, caption, created_at, visibility, is_nsfw, location,
          likes_count, comments_count,
          author:users!posts_author_id_users_id_fk(
            id, username, first_name, verified,
            avatar:avatar_id(url)
          ),
          media:posts_media(type, url, "order")
        `,
          { count: "exact" },
        )
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(cursor, cursor + limit - 1),

      // 2. Viewer's liked post IDs — use integer ID
      intUserId
        ? supabase.from("post_likes").select("post_id").eq("user_id", intUserId)
        : Promise.resolve({ data: [] }),

      // 3. Viewer's bookmarked post IDs — use integer ID
      intUserId
        ? supabase.from("bookmarks").select("post_id").eq("user_id", intUserId)
        : Promise.resolve({ data: [] }),

      // 4. Stories with unseen items (last 24 hours)
      supabase
        .from("stories")
        .select(
          `
          id, user_id,
          user:users!stories_user_id_fkey(id, username, avatar:avatar_id(url)),
          items:stories_items(id, url, thumbnail, type, created_at)
        `,
        )
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        )
        .order("created_at", { ascending: false })
        .limit(30),

      // 5. Unread message count — use integer ID
      intUserId
        ? supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .or(`user1_id.eq.${intUserId},user2_id.eq.${intUserId}`)
            .gt("unread_count", 0)
        : Promise.resolve({ count: 0 }),

      // 6. Unread notification count — use integer ID
      intUserId
        ? supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", intUserId)
            .is("read_at", null)
        : Promise.resolve({ count: 0 }),

      // 7. Viewer profile snippet (auth_id is UUID — this one is correct)
      supabase
        .from("users")
        .select("id, username, first_name, avatar:avatar_id(url), verified")
        .eq("auth_id", user_id)
        .single(),
    ]);

    // ── Build response ─────────────────────────────────────────────

    const posts = postsResult.data || [];
    const totalPosts = postsResult.count || 0;

    // Build liked/bookmarked sets for O(1) lookup
    const likedSet = new Set(
      (viewerLikesResult.data || []).map((r: any) => String(r.post_id)),
    );
    const bookmarkedSet = new Set(
      (viewerBookmarksResult.data || []).map((r: any) => String(r.post_id)),
    );

    // Transform posts with pre-resolved viewer state
    const transformedPosts = posts.map((p: any) => {
      const pid = String(p.id);
      const author = p.author;
      const avatarUrl =
        typeof author?.avatar === "object" ? author?.avatar?.url : null;

      return {
        id: pid,
        caption: p.caption || "",
        createdAt: p.created_at,
        isNSFW: p.is_nsfw || false,
        location: p.location || null,
        likes: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        viewerHasLiked: likedSet.has(pid),
        viewerHasBookmarked: bookmarkedSet.has(pid),
        author: {
          id: author?.id ? String(author.id) : undefined,
          username: author?.username || "unknown",
          firstName: author?.first_name || "",
          avatar: avatarUrl || "",
          verified: author?.verified || false,
        },
        media: (p.media || [])
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((m: any) => ({
            type: m.type || "image",
            url: m.url || "",
          })),
      };
    });

    // Transform stories
    const stories = (storiesResult.data || []).map((s: any) => {
      const items = s.items || [];
      const lastItem = items[items.length - 1];
      const user = s.user;
      const avatarUrl =
        typeof user?.avatar === "object" ? user?.avatar?.url : null;

      return {
        id: String(s.id),
        userId: String(s.user_id),
        username: user?.username || "unknown",
        avatarUrl: avatarUrl || "",
        latestThumbnail: lastItem?.thumbnail || lastItem?.url || "",
        itemCount: items.length,
      };
    });

    // Viewer context
    const viewerProfile = viewerProfileResult.data;
    const viewerAvatarUrl =
      typeof viewerProfile?.avatar === "object"
        ? viewerProfile?.avatar?.url
        : null;

    const hasMore = totalPosts > cursor + limit;
    const nextCursor = hasMore ? cursor + limit : null;
    const elapsed = Date.now() - t0;

    const response = {
      posts: transformedPosts,
      stories,
      viewer: {
        id: user_id,
        username: viewerProfile?.username || "",
        avatarUrl: viewerAvatarUrl || "",
        unreadMessages: unreadMessagesResult.count || 0,
        unreadNotifications: unreadNotificationsResult.count || 0,
      },
      nextCursor,
      hasMore,
      _meta: {
        elapsed,
        postCount: transformedPosts.length,
        storyCount: stories.length,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (err: any) {
    console.error("[bootstrap-feed] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
