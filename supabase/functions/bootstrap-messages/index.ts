/**
 * Bootstrap Messages Edge Function
 *
 * POST /bootstrap-messages
 *
 * Returns all above-the-fold data for the messages screen in a single request:
 * - Filtered conversations (primary inbox)
 * - Unread counts (inbox + spam)
 * - Viewer context
 *
 * Eliminates: getFilteredConversations + getUnreadCount + getSpamUnreadCount waterfall.
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
    const { user_id, filter = "primary", limit = 30 } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Get user's auth_id from users table ────────────────────────
    const { data: userRow } = await supabase
      .from("users")
      .select("id, auth_id, username")
      .eq("auth_id", user_id)
      .single();

    if (!userRow) {
      return new Response(JSON.stringify({ error: "user not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authId = userRow.auth_id;
    const userIntId = userRow.id;

    // ── 2. Get user's following list (for primary/requests split) ─────
    const { data: followingRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userIntId);

    const followingIds = new Set(
      (followingRows || []).map((f: any) => String(f.following_id)),
    );

    // ── 3. Get conversations where user is a participant ──────────────
    const { data: convRels } = await supabase
      .from("conversations_rels")
      .select("parent_id")
      .eq("users_id", authId);

    const convIds = (convRels || []).map((r: any) => r.parent_id);

    if (convIds.length === 0) {
      return new Response(
        JSON.stringify({
          conversations: [],
          unreadInbox: 0,
          unreadSpam: 0,
          _meta: { elapsed: Date.now() - t0, count: 0 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // ── 4. Fetch conversation details + last message + other user ─────
    const conversations = await Promise.all(
      convIds.map(async (convId: number) => {
        // Get conversation metadata
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, is_group, group_name, last_message_at")
          .eq("id", convId)
          .single();

        if (!conv) return null;

        // Get last message (may not exist for new conversations)
        const { data: lastMsgArr } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(1);
        const lastMsg = lastMsgArr?.[0] || null;

        // Get other participant
        const { data: otherParticipants } = await supabase
          .from("conversations_rels")
          .select("users_id")
          .eq("parent_id", convId)
          .neq("users_id", authId)
          .limit(1);

        const otherAuthId = otherParticipants?.[0]?.users_id;
        let otherUser: any = null;
        if (otherAuthId) {
          const { data: userData } = await supabase
            .from("users")
            .select("id, auth_id, username, avatar_id")
            .eq("auth_id", otherAuthId)
            .single();

          if (userData?.avatar_id) {
            const { data: avatarMedia } = await supabase
              .from("media")
              .select("url")
              .eq("id", userData.avatar_id)
              .single();
            otherUser = { ...userData, avatarUrl: avatarMedia?.url || "" };
          } else {
            otherUser = { ...userData, avatarUrl: "" };
          }
        }

        // Check unread
        const { count: unreadCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .is("read_at", null)
          .neq("sender_id", userIntId);

        const hasUnread = (unreadCount ?? 0) > 0;

        // Determine if this is primary or request
        const otherIntId = otherUser?.id ? String(otherUser.id) : "";
        const isFollowed = followingIds.has(otherIntId);

        return {
          id: String(convId),
          user: {
            id: otherUser?.id ? String(otherUser.id) : "",
            authId: otherUser?.auth_id || otherAuthId || "",
            name: otherUser?.username || "Unknown",
            username: otherUser?.username || "unknown",
            avatar: otherUser?.avatarUrl || "",
          },
          lastMessage: lastMsg?.content || "",
          timestamp: conv.last_message_at || lastMsg?.created_at || "",
          unread: hasUnread,
          isGroup: !!conv.is_group,
          isPrimary: isFollowed || conv.is_group,
        };
      }),
    );

    const validConvs = conversations
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

    // ── 5. Split into primary/requests and count unreads ──────────────
    const primary = validConvs.filter((c: any) => c.isPrimary);
    const requests = validConvs.filter((c: any) => !c.isPrimary);

    const filteredConvs = filter === "primary" ? primary : requests;
    const unreadInbox = primary.filter((c: any) => c.unread).length;
    const unreadSpam = requests.filter((c: any) => c.unread).length;

    // Strip isPrimary from response
    const cleanConvs = filteredConvs
      .slice(0, limit)
      .map(({ isPrimary, ...rest }: any) => rest);

    const elapsed = Date.now() - t0;

    return new Response(
      JSON.stringify({
        conversations: cleanConvs,
        unreadInbox,
        unreadSpam,
        _meta: { elapsed, count: cleanConvs.length },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[bootstrap-messages] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
