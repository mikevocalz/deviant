import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt, getCurrentUserAuthId } from "./auth-helper";
import { requireBetterAuthToken } from "../auth/identity";
import { useAuthStore } from "../stores/auth-store";

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

      // conversations_rels.users_id is a UUID column → use auth_id
      const authId = await getCurrentUserAuthId();
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

      // Get last message and other participant for each conversation
      const conversations = await Promise.all(
        (data || []).map(async (conv: any) => {
          const convId = conv.conversation[DB.conversations.id];

          // Get last message
          const { data: lastMessage } = await supabase
            .from(DB.messages.table)
            .select(
              `
              ${DB.messages.content},
              ${DB.messages.createdAt},
              sender:${DB.messages.senderId}(${DB.users.username})
            `,
            )
            .eq(DB.messages.conversationId, convId)
            .order(DB.messages.createdAt, { ascending: false })
            .limit(1)
            .single();

          // Get other participant's auth_id
          // conversations_rels.users_id is TEXT (auth_id), not a FK — can't use Supabase join
          const { data: participants } = await supabase
            .from(DB.conversationsRels.table)
            .select(DB.conversationsRels.usersId)
            .eq(DB.conversationsRels.parentId, convId)
            .neq(DB.conversationsRels.usersId, authId)
            .limit(1);

          const otherAuthId = participants?.[0]?.[DB.conversationsRels.usersId];
          let otherUserData: any = null;
          if (otherAuthId) {
            const { data: userData } = await supabase
              .from(DB.users.table)
              .select(
                `${DB.users.id}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
              )
              .eq(DB.users.authId, otherAuthId)
              .single();
            otherUserData = userData;
          }

          // Check for unread messages (not sent by me, read_at is null)
          const visitorIntId = getCurrentUserIdInt();
          let hasUnread = false;
          if (visitorIntId) {
            const { count } = await supabase
              .from(DB.messages.table)
              .select(DB.messages.id, { count: "exact", head: true })
              .eq(DB.messages.conversationId, convId)
              .is(DB.messages.readAt, null)
              .neq(DB.messages.senderId, visitorIntId);
            hasUnread = (count ?? 0) > 0;
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
        }),
      );

      // Sort by most recent message first
      conversations.sort((a: any, b: any) => {
        const tA = new Date(a._rawTs || 0).getTime();
        const tB = new Date(b._rawTs || 0).getTime();
        return tB - tA;
      });

      // Strip internal field before returning
      return conversations.map(({ _rawTs, ...rest }: any) => rest);
    } catch (error) {
      console.error("[Messages] getConversations error:", error);
      return [];
    }
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, limit: number = 50) {
    try {
      console.log("[Messages] getMessages:", conversationId);

      const visitorId = getCurrentUserIdInt();
      if (!visitorId) return [];

      const { data, error } = await supabase
        .from(DB.messages.table)
        .select(
          `
          ${DB.messages.id},
          ${DB.messages.content},
          ${DB.messages.senderId},
          ${DB.messages.metadata},
          ${DB.messages.createdAt}
        `,
        )
        .eq(DB.messages.conversationId, parseInt(conversationId))
        .order(DB.messages.createdAt, { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((msg: any) => ({
        id: String(msg[DB.messages.id]),
        text: msg[DB.messages.content],
        sender: msg[DB.messages.senderId] === visitorId ? "user" : "other",
        senderId: String(msg[DB.messages.senderId]),
        timestamp: formatTimeAgo(msg[DB.messages.createdAt]),
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
        mediaUrl: data.media?.[0]?.uri,
      };
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
      const otherUserIdInt = parseInt(otherUserId);

      const { data: response, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { conversationId: string; isNew: boolean };
        error?: { code: string; message: string };
      }>("create-conversation", {
        body: { otherUserId: otherUserIdInt },
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
   * Get unread message count
   */
  async getUnreadCount() {
    try {
      // conversations_rels.users_id is UUID, messages.sender_id is integer
      const authId = await getCurrentUserAuthId();
      const visitorIntId = getCurrentUserIdInt();
      if (!authId) return 0;

      // Get conversations where user is a participant
      const { data: convs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, authId);

      if (!convs || convs.length === 0) return 0;

      // Count distinct conversations that have unread messages (not total messages)
      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);
      let query = supabase
        .from(DB.messages.table)
        .select(DB.messages.conversationId)
        .in(DB.messages.conversationId, convIds)
        .is(DB.messages.readAt, null);
      if (visitorIntId) query = query.neq(DB.messages.senderId, visitorIntId);
      const { data: unreadMsgs, error } = await query;

      if (error) throw error;

      // Count unique conversation IDs
      const uniqueConvIds = new Set(
        (unreadMsgs || []).map((m: any) => m[DB.messages.conversationId]),
      );
      return uniqueConvIds.size;
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
      const authId = await getCurrentUserAuthId();
      const visitorIntId = getCurrentUserIdInt();
      if (!authId) return 0;

      // Get IDs of users the current user is following
      const followingIds = await this.getFollowingIds();

      // Get conversations where user is a participant
      const { data: convs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, authId);

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
      const visitorIntId = getCurrentUserIdInt();
      if (!visitorIntId) return;

      // Mark all messages in conversation as read (except own messages)
      await supabase
        .from(DB.messages.table)
        .update({ [DB.messages.readAt]: new Date().toISOString() })
        .eq(DB.messages.conversationId, parseInt(conversationId))
        .is(DB.messages.readAt, null)
        .neq(DB.messages.senderId, visitorIntId);
    } catch (error) {
      console.error("[Messages] markAsRead error:", error);
    }
  },

  /**
   * Delete (unsend) a message — only the sender can delete their own message
   */
  async deleteMessage(messageId: string) {
    try {
      const visitorIntId = getCurrentUserIdInt();
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
      const visitorIntId = getCurrentUserIdInt();
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
      const visitorIntId = getCurrentUserIdInt();
      const authId = await getCurrentUserAuthId();
      if (!visitorIntId || !authId) throw new Error("Not authenticated");

      // Fetch current metadata
      const { data: msg, error: fetchError } = await supabase
        .from(DB.messages.table)
        .select(`${DB.messages.metadata}`)
        .eq(DB.messages.id, parseInt(messageId))
        .single();

      if (fetchError) throw fetchError;

      const meta = msg?.[DB.messages.metadata] || {};
      const reactions: Array<{
        emoji: string;
        userId: string;
        username: string;
      }> = Array.isArray(meta.reactions) ? meta.reactions : [];

      // Toggle: remove if already reacted with same emoji, otherwise add
      const existingIdx = reactions.findIndex(
        (r) => r.emoji === emoji && r.userId === authId,
      );

      const user = useAuthStore.getState().user;
      if (existingIdx >= 0) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions.push({
          emoji,
          userId: authId,
          username: user?.username || "user",
        });
      }

      // Update metadata with new reactions
      const { error: updateError } = await supabase
        .from(DB.messages.table)
        .update({
          [DB.messages.metadata]: { ...meta, reactions },
        })
        .eq(DB.messages.id, parseInt(messageId));

      if (updateError) throw updateError;
      console.log("[Messages] reactToMessage success:", messageId, emoji);
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
      const conversations = await this.getConversations();
      const followingIds = await this.getFollowingIds();

      if (filter === "primary") {
        // Return conversations from followed users
        return conversations.filter((c) => {
          // For now, return all conversations as primary
          // TODO: Implement proper filtering based on user IDs
          return true;
        });
      } else {
        // Return conversations from non-followed users (message requests)
        return conversations.filter((c) => {
          // TODO: Implement proper filtering based on user IDs
          return false;
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
      const visitorId = getCurrentUserIdInt();
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
