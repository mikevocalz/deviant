import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import {
  getCurrentUserIdInt,
  getCurrentUserAuthId,
  resolveUserIdInt,
} from "./auth-helper";
import {
  requireBetterAuthToken,
  getCurrentUserId as getCurrentUserIdAsync,
} from "../auth/identity";
import { useAuthStore } from "../stores/auth-store";

/**
 * Resilient visitor ID resolver — tries sync first, falls back to async.
 * Prevents silent null returns that break all message queries.
 */
async function resolveVisitorIdInt(): Promise<number | null> {
  const syncId = getCurrentUserIdInt();
  if (syncId) return syncId;
  // Sync failed (non-numeric user.id) — resolve via DB lookup
  const asyncId = await getCurrentUserIdAsync();
  if (asyncId) return asyncId;
  console.warn("[Messages] resolveVisitorIdInt: could not resolve visitor ID");
  return null;
}

interface SendMessageResponse {
  ok: boolean;
  data?: { message: any };
  error?: { code: string; message: string };
}

export const messagesApi = {
  /**
   * Get conversations list
   */
  async getConversations() {
    try {
      console.log("[Messages] getConversations");

      // Resolve auth + visitor ID in parallel — ONCE, not per-conversation
      const [authId, visitorIntId] = await Promise.all([
        getCurrentUserAuthId(),
        resolveVisitorIdInt(),
      ]);
      if (!authId) return [];

      // Get conversations where user is a participant
      const { data, error } = await supabase
        .from(DB.conversationsRels.table)
        .select(
          `
          conversation:${DB.conversationsRels.parentId}(
            ${DB.conversations.id},
            ${DB.conversations.lastMessageAt},
            ${DB.conversations.isGroup},
            ${DB.conversations.groupName}
          )
        `,
        )
        .eq(DB.conversationsRels.usersId, authId)
        .order(DB.conversationsRels.parentId, { ascending: false });

      if (error) throw error;

      // Process each conversation — parallel queries within each, all convs in parallel
      const conversations = await Promise.all(
        (data || []).map(async (conv: any) => {
          const convId = conv.conversation[DB.conversations.id];

          try {
            // Fire independent queries in parallel
            const [lastMessageResult, participantsResult, unreadResult] =
              await Promise.all([
                // Last message (no join — avoids FK ambiguity)
                supabase
                  .from(DB.messages.table)
                  .select(`${DB.messages.content}, ${DB.messages.createdAt}`)
                  .eq(DB.messages.conversationId, convId)
                  .order(DB.messages.createdAt, { ascending: false })
                  .limit(1)
                  .single(),
                // Other participant's auth_id
                supabase
                  .from(DB.conversationsRels.table)
                  .select(DB.conversationsRels.usersId)
                  .eq(DB.conversationsRels.parentId, convId)
                  .neq(DB.conversationsRels.usersId, authId)
                  .limit(1),
                // Unread count
                visitorIntId
                  ? supabase
                      .from(DB.messages.table)
                      .select(DB.messages.id, { count: "exact", head: true })
                      .eq(DB.messages.conversationId, convId)
                      .is(DB.messages.readAt, null)
                      .neq(DB.messages.senderId, visitorIntId)
                  : Promise.resolve({ count: 0 }),
              ]);

            const lastMessage = lastMessageResult.data;

            // Skip conversations with no messages — these are "ghost" conversations
            // created by getOrCreateConversation but never actually used
            if (!lastMessage) return null;

            const hasUnread = ((unreadResult as any).count ?? 0) > 0;

            // Other user lookup — depends on participant result (only sequential dep)
            const otherAuthId =
              participantsResult.data?.[0]?.[DB.conversationsRels.usersId];
            let otherUserData: any = null;
            if (otherAuthId) {
              const { data: userData } = await supabase
                .from(DB.users.table)
                .select(
                  `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
                )
                .eq(DB.users.authId, otherAuthId)
                .single();
              otherUserData = userData;
            }

            const rawTs =
              lastMessage?.[DB.messages.createdAt] ||
              conv.conversation[DB.conversations.lastMessageAt] ||
              "";

            return {
              id: String(convId),
              user: {
                id: otherUserData?.[DB.users.id]
                  ? String(otherUserData[DB.users.id])
                  : "",
                authId: otherUserData?.[DB.users.authId] || otherAuthId || "",
                name: otherUserData?.[DB.users.username] || "Unknown",
                username: otherUserData?.[DB.users.username] || "unknown",
                avatar: otherUserData?.avatar?.url || "",
              },
              lastMessage: lastMessage?.[DB.messages.content] || "",
              timestamp: formatTimeAgo(rawTs),
              unread: hasUnread,
              isGroup: !!conv.conversation[DB.conversations.isGroup],
              _rawTs: rawTs,
            };
          } catch (convError) {
            console.error(
              "[Messages] Error processing conversation",
              convId,
              convError,
            );
            return null;
          }
        }),
      );

      // Filter out failed conversations, sort by most recent
      const valid = conversations.filter(Boolean);
      valid.sort((a: any, b: any) => {
        const tA = new Date(a._rawTs || 0).getTime();
        const tB = new Date(b._rawTs || 0).getTime();
        return tB - tA;
      });

      // Strip internal field before returning
      return valid.map(({ _rawTs, ...rest }: any) => rest);
    } catch (error) {
      console.error("[Messages] getConversations error:", error);
      return [];
    }
  },

  /**
   * Get a single conversation by ID — NO ghost filter.
   * Used by the chat screen to resolve recipient info for any conversation,
   * including newly created ones with zero messages.
   */
  async getConversationById(conversationId: string) {
    try {
      const authId = await getCurrentUserAuthId();
      if (!authId) return null;

      const convIdInt = parseInt(conversationId);
      if (isNaN(convIdInt)) return null;

      // Get conversation + other participant in parallel
      const [convResult, participantsResult] = await Promise.all([
        supabase
          .from(DB.conversations.table)
          .select(
            `${DB.conversations.id}, ${DB.conversations.isGroup}, ${DB.conversations.groupName}`,
          )
          .eq(DB.conversations.id, convIdInt)
          .single(),
        supabase
          .from(DB.conversationsRels.table)
          .select(DB.conversationsRels.usersId)
          .eq(DB.conversationsRels.parentId, convIdInt)
          .neq(DB.conversationsRels.usersId, authId)
          .limit(1),
      ]);

      if (convResult.error || !convResult.data) return null;

      const otherAuthId =
        participantsResult.data?.[0]?.[DB.conversationsRels.usersId];
      let otherUserData: any = null;
      if (otherAuthId) {
        const { data: userData } = await supabase
          .from(DB.users.table)
          .select(
            `${DB.users.id}, ${DB.users.authId}, ${DB.users.username}, ${DB.users.firstName}, avatar:${DB.users.avatarId}(url)`,
          )
          .eq(DB.users.authId, otherAuthId)
          .single();
        otherUserData = userData;
      }

      return {
        id: String(convIdInt),
        user: {
          id: otherUserData?.[DB.users.id]
            ? String(otherUserData[DB.users.id])
            : "",
          authId: otherUserData?.[DB.users.authId] || otherAuthId || "",
          name:
            otherUserData?.[DB.users.firstName] ||
            otherUserData?.[DB.users.username] ||
            "Unknown",
          username: otherUserData?.[DB.users.username] || "unknown",
          avatar: otherUserData?.avatar?.url || "",
        },
        isGroup: !!convResult.data[DB.conversations.isGroup],
      };
    } catch (error) {
      console.error("[Messages] getConversationById error:", error);
      return null;
    }
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, limit: number = 50) {
    try {
      console.log("[Messages] getMessages:", conversationId);

      const visitorId = await resolveVisitorIdInt();
      if (!visitorId) {
        console.error(
          "[Messages] getMessages: no visitor ID, cannot load messages",
        );
        return [];
      }

      const convIdInt = parseInt(conversationId);
      if (isNaN(convIdInt)) {
        console.error(
          "[Messages] getMessages: invalid conversationId:",
          conversationId,
        );
        return [];
      }

      const { data, error } = await supabase
        .from(DB.messages.table)
        .select(
          `
          ${DB.messages.id},
          ${DB.messages.content},
          ${DB.messages.senderId},
          ${DB.messages.metadata},
          ${DB.messages.createdAt},
          ${DB.messages.readAt}
        `,
        )
        .eq(DB.messages.conversationId, convIdInt)
        .order(DB.messages.createdAt, { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((msg: any) => ({
        id: String(msg[DB.messages.id]),
        text: msg[DB.messages.content],
        sender: msg[DB.messages.senderId] === visitorId ? "user" : "other",
        senderId: String(msg[DB.messages.senderId]),
        timestamp: formatTimeAgo(msg[DB.messages.createdAt]),
        createdAt: msg[DB.messages.createdAt],
        readAt: msg[DB.messages.readAt] || null,
        metadata: msg[DB.messages.metadata] || null,
      }));
    } catch (error) {
      console.error("[Messages] getMessages error:", error);
      return [];
    }
  },

  /**
   * Send message via Edge Function
   */
  async sendMessage(data: {
    conversationId: string;
    content: string;
    media?: Array<{ uri: string; type: "image" | "video" }>;
    metadata?: Record<string, unknown>;
  }) {
    try {
      console.log(
        "[Messages] sendMessage via Edge Function:",
        data.conversationId,
      );

      const token = await requireBetterAuthToken();
      const conversationIdInt = parseInt(data.conversationId);

      const body: Record<string, unknown> = {
        conversationId: conversationIdInt,
        content: data.content,
      };
      if (data.media && data.media.length > 0) {
        body.mediaItems = data.media;
        // Backwards compat: also set mediaUrl for single items
        body.mediaUrl = data.media[0].uri;
      }
      if (data.metadata) {
        body.metadata = data.metadata;
      }

      const { data: response, error } =
        await supabase.functions.invoke<SendMessageResponse>("send-message", {
          body,
          headers: { Authorization: `Bearer ${token}` },
        });

      if (error) {
        console.error("[Messages] Edge Function error:", error);
        throw new Error(error.message || "Failed to send message");
      }

      if (!response?.ok || !response?.data?.message) {
        const errorMessage =
          response?.error?.message || "Failed to send message";
        throw new Error(errorMessage);
      }

      console.log("[Messages] sendMessage success:", response.data.message.id);
      return response.data.message;
    } catch (error) {
      console.error("[Messages] sendMessage error:", error);
      throw error;
    }
  },

  /**
   * Create or get direct conversation via Edge Function
   */
  async getOrCreateConversation(otherUserId: string) {
    try {
      const token = await requireBetterAuthToken();

      let bodyPayload: { otherUserId?: number; otherAuthId?: string };
      try {
        const otherUserIdInt = await resolveUserIdInt(otherUserId);
        bodyPayload = { otherUserId: otherUserIdInt };
      } catch (e: any) {
        if (e?.message?.startsWith("NEEDS_PROVISION:")) {
          bodyPayload = {
            otherAuthId: e.message.replace("NEEDS_PROVISION:", ""),
          };
        } else {
          throw e;
        }
      }

      const { data: response, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { conversationId: string; isNew: boolean };
        error?: { code: string; message: string };
      }>("create-conversation", {
        body: bodyPayload,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error)
        throw new Error(error.message || "Failed to create conversation");
      if (!response?.ok)
        throw new Error(
          response?.error?.message || "Failed to create conversation",
        );

      return response.data?.conversationId || "";
    } catch (error) {
      console.error("[Messages] getOrCreateConversation error:", error);
      throw error;
    }
  },

  /**
   * Get unread message count (INBOX ONLY — from followed users)
   * Spam messages should NOT inflate this count.
   */
  async getUnreadCount() {
    try {
      // Resolve auth IDs in parallel
      const [authId, visitorIntId] = await Promise.all([
        getCurrentUserAuthId(),
        resolveVisitorIdInt(),
      ]);
      if (!authId) return 0;

      // followingIds + conversations query in parallel
      const [followingIds, { data: convs }] = await Promise.all([
        this.getFollowingIds(),
        supabase
          .from(DB.conversationsRels.table)
          .select(DB.conversationsRels.parentId)
          .eq(DB.conversationsRels.usersId, authId),
      ]);

      if (!convs || convs.length === 0) return 0;

      // Get unread messages (need senderId to filter by followed)
      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);
      let query = supabase
        .from(DB.messages.table)
        .select(`${DB.messages.conversationId}, ${DB.messages.senderId}`)
        .in(DB.messages.conversationId, convIds)
        .is(DB.messages.readAt, null);
      if (visitorIntId) query = query.neq(DB.messages.senderId, visitorIntId);
      const { data: unreadMsgs, error } = await query;

      if (error) throw error;

      // Count distinct conversations with unread messages from FOLLOWED users only
      const inboxConvIds = new Set(
        (unreadMsgs || [])
          .filter((msg: any) =>
            followingIds.includes(String(msg[DB.messages.senderId])),
          )
          .map((msg: any) => msg[DB.messages.conversationId]),
      );
      return inboxConvIds.size;
    } catch (error) {
      console.error("[Messages] getUnreadCount error:", error);
      return 0;
    }
  },

  /**
   * Get spam unread message count (from users you don't follow back)
   */
  async getSpamUnreadCount() {
    try {
      // Resolve auth IDs in parallel
      const [authId, visitorIntId] = await Promise.all([
        getCurrentUserAuthId(),
        resolveVisitorIdInt(),
      ]);
      if (!authId) return 0;

      // followingIds + conversations query in parallel
      const [followingIds, { data: convs }] = await Promise.all([
        this.getFollowingIds(),
        supabase
          .from(DB.conversationsRels.table)
          .select(DB.conversationsRels.parentId)
          .eq(DB.conversationsRels.usersId, authId),
      ]);

      if (!convs || convs.length === 0) return 0;

      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);

      // Get unread messages from these conversations (need conversationId + senderId)
      let unreadQuery = supabase
        .from(DB.messages.table)
        .select(`${DB.messages.conversationId}, ${DB.messages.senderId}`)
        .in(DB.messages.conversationId, convIds)
        .is(DB.messages.readAt, null);
      if (visitorIntId)
        unreadQuery = unreadQuery.neq(DB.messages.senderId, visitorIntId);
      const { data: unreadMessages, error } = await unreadQuery;

      if (error) throw error;

      // Count distinct conversations with messages from users NOT in followingIds
      const spamConvIds = new Set(
        (unreadMessages || [])
          .filter(
            (msg: any) =>
              !followingIds.includes(String(msg[DB.messages.senderId])),
          )
          .map((msg: any) => msg[DB.messages.conversationId]),
      );

      return spamConvIds.size;
    } catch (error) {
      console.error("[Messages] getSpamUnreadCount error:", error);
      return 0;
    }
  },

  /**
   * Create a group conversation
   * Max 4 members including the creator
   */
  async createGroupConversation(participantIds: string[], groupName: string) {
    try {
      const myAuthId = await getCurrentUserAuthId();
      if (!myAuthId) throw new Error("Not authenticated");

      // Validate max group size (4 members including creator)
      const MAX_GROUP_MEMBERS = 4;
      const totalMembers = participantIds.length + 1; // +1 for creator
      if (totalMembers > MAX_GROUP_MEMBERS) {
        throw new Error(
          `Group chats can have max ${MAX_GROUP_MEMBERS} members`,
        );
      }

      // Look up auth_ids for participant integer IDs
      const { data: participants } = await supabase
        .from(DB.users.table)
        .select(`${DB.users.authId}`)
        .in(
          DB.users.id,
          participantIds.map((id) => parseInt(id)),
        );

      const participantAuthIds = (participants || [])
        .map((p: any) => p[DB.users.authId])
        .filter(Boolean);

      // Create the conversation
      const { data: conversation, error: convError } = await supabase
        .from(DB.conversations.table)
        .insert({
          [DB.conversations.isGroup]: true,
          [DB.conversations.groupName]: groupName,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add all participants including current user (users_id is TEXT/auth_id)
      const allAuthIds = [...new Set([myAuthId, ...participantAuthIds])];

      const participantInserts = allAuthIds.map((authId) => ({
        [DB.conversationsRels.parentId]: conversation[DB.conversations.id],
        [DB.conversationsRels.usersId]: authId,
        path: "participants",
      }));

      const { error: relError } = await supabase
        .from(DB.conversationsRels.table)
        .insert(participantInserts);

      if (relError) throw relError;

      return { id: String(conversation[DB.conversations.id]) };
    } catch (error) {
      console.error("[Messages] createGroupConversation error:", error);
      throw error;
    }
  },

  /**
   * Mark messages as read in a conversation
   */
  async markAsRead(conversationId: string) {
    try {
      const { requireBetterAuthToken } = await import("@/lib/auth/identity");
      const token = await requireBetterAuthToken();

      // Use edge function to bypass RLS — anon key cannot update messages table
      const { data, error } = await supabase.functions.invoke("mark-read", {
        body: { conversationId: parseInt(conversationId) },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("[Messages] markAsRead edge function error:", error);
        return;
      }

      if (!data?.ok) {
        console.error("[Messages] markAsRead failed:", data?.error);
        return;
      }

      console.log(
        "[Messages] markAsRead success:",
        data.data?.markedRead,
        "messages marked",
      );
    } catch (error) {
      console.error("[Messages] markAsRead error:", error);
    }
  },

  /**
   * Delete (unsend) a message — only the sender can delete their own message
   */
  async deleteMessage(messageId: string) {
    try {
      const visitorIntId = await resolveVisitorIdInt();
      if (!visitorIntId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from(DB.messages.table)
        .delete()
        .eq(DB.messages.id, parseInt(messageId))
        .eq(DB.messages.senderId, visitorIntId);

      if (error) throw error;
      console.log("[Messages] deleteMessage success:", messageId);
    } catch (error) {
      console.error("[Messages] deleteMessage error:", error);
      throw error;
    }
  },

  /**
   * Edit a message — only the sender can edit their own message
   */
  async editMessage(messageId: string, newContent: string) {
    try {
      const visitorIntId = await resolveVisitorIdInt();
      if (!visitorIntId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from(DB.messages.table)
        .update({ [DB.messages.content]: newContent })
        .eq(DB.messages.id, parseInt(messageId))
        .eq(DB.messages.senderId, visitorIntId)
        .select()
        .single();

      if (error) throw error;
      console.log("[Messages] editMessage success:", messageId);
      return data;
    } catch (error) {
      console.error("[Messages] editMessage error:", error);
      throw error;
    }
  },

  /**
   * React to a message with an emoji (toggle)
   * Stores reactions in the metadata JSONB column as an array
   */
  async reactToMessage(messageId: string, emoji: string) {
    try {
      const token = await requireBetterAuthToken();

      // Use Edge Function to bypass RLS (messages table RLS checks auth.uid()
      // which is null for Better Auth sessions — direct updates silently fail)
      const { data: response, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { reactions: any[]; toggled: string };
        error?: { code: string; message: string };
      }>("react-message", {
        body: { messageId: parseInt(messageId), emoji },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message || "Failed to react");
      if (!response?.ok) {
        throw new Error(response?.error?.message || "Failed to react");
      }

      console.log(
        "[Messages] reactToMessage success:",
        messageId,
        emoji,
        response.data?.toggled,
      );
    } catch (error) {
      console.error("[Messages] reactToMessage error:", error);
      throw error;
    }
  },

  /**
   * Get filtered conversations (primary = from followed users, requests = from others)
   */
  async getFilteredConversations(filter: "primary" | "requests") {
    try {
      // Parallel — conversations and followingIds are independent
      const [conversations, followingIds] = await Promise.all([
        this.getConversations(),
        this.getFollowingIds(),
      ]);

      if (filter === "primary") {
        // Inbox: conversations from users you follow
        return conversations.filter((c: any) => {
          const otherUserId = c.user?.id;
          if (!otherUserId) return false; // unknown users go to requests, not inbox
          return followingIds.includes(String(otherUserId));
        });
      } else {
        // Requests: conversations from users you DON'T follow (+ unknown users)
        return conversations.filter((c: any) => {
          const otherUserId = c.user?.id;
          if (!otherUserId) return true; // unknown users go to requests
          return !followingIds.includes(String(otherUserId));
        });
      }
    } catch (error) {
      console.error("[Messages] getFilteredConversations error:", error);
      return [];
    }
  },

  /**
   * Get IDs of users the current user is following
   */
  async getFollowingIds(): Promise<string[]> {
    try {
      const visitorId = await resolveVisitorIdInt();
      if (!visitorId) return [];

      const { data, error } = await supabase
        .from(DB.follows.table)
        .select(DB.follows.followingId)
        .eq(DB.follows.followerId, visitorId);

      if (error) throw error;

      return (data || []).map((f: any) => String(f[DB.follows.followingId]));
    } catch (error) {
      console.error("[Messages] getFollowingIds error:", error);
      return [];
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}
