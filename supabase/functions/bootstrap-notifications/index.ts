/**
 * Bootstrap Notifications Edge Function
 *
 * POST /bootstrap-notifications
 *
 * Returns ALL above-the-fold data for the activity screen in a single request:
 * - Activity items with actor avatars pre-resolved
 * - Unread count
 * - Viewer's follow state for all actors (for follow-back buttons)
 *
 * Eliminates: useActivitiesQuery + fetchFollowingState + getBadges waterfall.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const { user_id, limit = 50 } = await req.json();

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

    // ── Fire ALL queries in parallel ──────────────────────────────

    const [notificationsResult, unreadCountResult] = await Promise.all([
      // 1. Notifications with sender info + post/event refs
      supabase
        .from("notifications")
        .select(
          `
          id, type, created_at, read_at, content,
          entity_type, entity_id,
          sender:users!notifications_sender_id_fkey(
            id, username, avatar:avatar_id(url)
          ),
          post:posts!notifications_entity_id_fkey(
            id, media:posts_media(url, "order")
          )
        `,
        )
        .eq("recipient_id", user_id)
        .order("created_at", { ascending: false })
        .limit(limit),

      // 2. Unread count
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user_id)
        .is("read_at", null),
    ]);

    const notifications = notificationsResult.data || [];

    // 3. Get unique sender IDs to batch-check follow state
    const senderIds = [
      ...new Set(
        notifications
          .map((n: any) => n.sender?.id)
          .filter(Boolean)
          .map(Number)
          .filter((id: number) => !isNaN(id)),
      ),
    ];

    // 4. Batch fetch viewer's follow state for all actors
    // KEY BY USERNAME so client can look up without ID→username mapping
    let viewerFollowingByUsername: Record<string, boolean> = {};
    let viewerFollowingByIds: Record<string, boolean> = {};
    if (senderIds.length > 0) {
      const { data: follows } = await supabase
        .from("follows")
        .select(
          "following_id, target:users!follows_following_id_fkey(username)",
        )
        .eq("follower_id", user_id)
        .in("following_id", senderIds);

      if (follows) {
        follows.forEach((f: any) => {
          const username = f.target?.username;
          if (username) {
            viewerFollowingByUsername[username] = true;
          }
          viewerFollowingByIds[String(f.following_id)] = true;
        });
      }
    }

    // ── Transform response ─────────────────────────────────────────

    const activities = notifications.map((n: any) => {
      const sender = n.sender;
      const senderAvatarUrl =
        typeof sender?.avatar === "object" ? sender?.avatar?.url : null;

      // Get post thumbnail (first media item)
      let postThumbnail = "";
      if (n.post?.media?.length) {
        const sorted = [...n.post.media].sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0),
        );
        postThumbnail = sorted[0]?.url || "";
      }

      const senderUsername = sender?.username || "user";
      return {
        id: String(n.id),
        type: n.type || "like",
        createdAt: n.created_at,
        isRead: !!n.read_at,
        actor: {
          id: sender?.id ? String(sender.id) : "",
          username: senderUsername,
          avatarUrl: senderAvatarUrl || "",
          // Embed viewerFollows directly in actor DTO — no separate lookup needed
          viewerFollows: !!viewerFollowingByUsername[senderUsername],
        },
        entityType: n.entity_type || null,
        entityId: n.entity_id ? String(n.entity_id) : null,
        post: n.post
          ? { id: String(n.post.id), thumbnailUrl: postThumbnail }
          : undefined,
        commentText: n.content || undefined,
      };
    });

    const elapsed = Date.now() - t0;

    const response = {
      activities,
      unreadCount: unreadCountResult.count || 0,
      // Keyed by username for client compatibility
      viewerFollowing: viewerFollowingByUsername,
      // Also include ID-keyed version for backward compat
      viewerFollowingByIds,
      _meta: {
        elapsed,
        activityCount: activities.length,
        followStateCount: Object.keys(viewerFollowingByUsername).length,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=15",
      },
    });
  } catch (err: any) {
    console.error("[bootstrap-notifications] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
