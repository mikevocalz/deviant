import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId, getCurrentUserIdInt } from "./auth-helper";

export const messagesApi = {
  /**
   * Get conversations list
   */
  async getConversations() {
    try {
      console.log("[Messages] getConversations");

      const visitorId = getCurrentUserIdInt();
      if (!visitorId) return [];

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
        .eq(DB.conversationsRels.usersId, visitorId)
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

          // Get other participant
          const { data: participants } = await supabase
            .from(DB.conversationsRels.table)
            .select(
              `
              user:${DB.conversationsRels.usersId}(
                ${DB.users.id},
                ${DB.users.username},
                avatar:${DB.users.avatarId}(url)
              )
            `,
            )
            .eq(DB.conversationsRels.parentId, convId)
            .neq(DB.conversationsRels.usersId, visitorId)
            .limit(1);

          const otherUserData = participants?.[0]?.user as any;

          return {
            id: String(convId),
            user: {
              name: otherUserData?.[DB.users.username] || "Unknown",
              username: otherUserData?.[DB.users.username] || "unknown",
              avatar:
                otherUserData?.avatar?.[0]?.url ||
                otherUserData?.avatar?.url ||
                "",
            },
            lastMessage: lastMessage?.[DB.messages.content] || "",
            timestamp: formatTimeAgo(
              lastMessage?.[DB.messages.createdAt] ||
                conv.conversation[DB.conversations.lastMessageAt],
            ),
            unread: false, // TODO: implement unread logic
          };
        }),
      );

      return conversations;
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
        timestamp: formatTimeAgo(msg[DB.messages.createdAt]),
      }));
    } catch (error) {
      console.error("[Messages] getMessages error:", error);
      return [];
    }
  },

  /**
   * Send message
   */
  async sendMessage(data: {
    conversationId: string;
    content: string;
    media?: Array<{ uri: string; type: "image" | "video" }>;
  }) {
    try {
      console.log("[Messages] sendMessage:", data.conversationId);

      const visitorId = getCurrentUserIdInt();
      if (!visitorId) throw new Error("Not authenticated");

      const { data: result, error } = await supabase
        .from(DB.messages.table)
        .insert({
          [DB.messages.conversationId]: parseInt(data.conversationId),
          [DB.messages.senderId]: visitorId,
          [DB.messages.content]: data.content,
          [DB.messages.read]: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from(DB.conversations.table)
        .update({ [DB.conversations.lastMessageAt]: new Date().toISOString() })
        .eq(DB.conversations.id, parseInt(data.conversationId));

      return result;
    } catch (error) {
      console.error("[Messages] sendMessage error:", error);
      throw error;
    }
  },

  /**
   * Create or get direct conversation
   */
  async getOrCreateConversation(otherUserId: string) {
    try {
      const visitorId = getCurrentUserIdInt();
      if (!visitorId) throw new Error("Not authenticated");

      // Check if conversation exists between these two users
      const { data: existingConvs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, visitorId);

      if (existingConvs && existingConvs.length > 0) {
        // Check if any of these conversations include the other user
        for (const conv of existingConvs) {
          const { data: otherParticipant } = await supabase
            .from(DB.conversationsRels.table)
            .select("*")
            .eq(
              DB.conversationsRels.parentId,
              conv[DB.conversationsRels.parentId],
            )
            .eq(DB.conversationsRels.usersId, parseInt(otherUserId))
            .single();

          if (otherParticipant) {
            return String(conv[DB.conversationsRels.parentId]);
          }
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from(DB.conversations.table)
        .insert({
          [DB.conversations.isGroup]: false,
          [DB.conversations.lastMessageAt]: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      await supabase.from(DB.conversationsRels.table).insert([
        {
          [DB.conversationsRels.parentId]: newConv[DB.conversations.id],
          [DB.conversationsRels.usersId]: visitorId,
        },
        {
          [DB.conversationsRels.parentId]: newConv[DB.conversations.id],
          [DB.conversationsRels.usersId]: parseInt(otherUserId),
        },
      ]);

      return String(newConv[DB.conversations.id]);
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
      const visitorId = getCurrentUserIdInt();
      if (!visitorId) return 0;

      // Get conversations where user is a participant
      const { data: convs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, visitorId);

      if (!convs || convs.length === 0) return 0;

      // Count unread messages in these conversations
      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);
      const { count, error } = await supabase
        .from(DB.messages.table)
        .select("*", { count: "exact", head: true })
        .in(DB.messages.conversationId, convIds)
        .eq(DB.messages.read, false)
        .neq(DB.messages.senderId, visitorId);

      if (error) throw error;

      return count || 0;
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
      const visitorId = getCurrentUserIdInt();
      if (!visitorId) return 0;

      // Get IDs of users the current user is following
      const followingIds = await this.getFollowingIds();

      // Get conversations where user is a participant
      const { data: convs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, visitorId);

      if (!convs || convs.length === 0) return 0;

      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);

      // Get unread messages from these conversations
      const { data: unreadMessages, error } = await supabase
        .from(DB.messages.table)
        .select(`${DB.messages.senderId}`)
        .in(DB.messages.conversationId, convIds)
        .eq(DB.messages.read, false)
        .neq(DB.messages.senderId, visitorId);

      if (error) throw error;

      // Count messages from users NOT in followingIds (spam/requests)
      const spamCount = (unreadMessages || []).filter(
        (msg) => !followingIds.includes(String(msg[DB.messages.senderId])),
      ).length;

      return spamCount;
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
      const visitorId = getCurrentUserIdInt();
      if (!visitorId) throw new Error("Not authenticated");

      // Validate max group size (4 members including creator)
      const MAX_GROUP_MEMBERS = 4;
      const totalMembers = participantIds.length + 1; // +1 for creator
      if (totalMembers > MAX_GROUP_MEMBERS) {
        throw new Error(
          `Group chats can have max ${MAX_GROUP_MEMBERS} members`,
        );
      }

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

      // Add all participants including current user
      const allParticipantIds = [
        ...new Set([...participantIds.map((id) => parseInt(id)), visitorId]),
      ];

      const participantInserts = allParticipantIds.map((userId) => ({
        [DB.conversationsRels.parentId]: conversation[DB.conversations.id],
        [DB.conversationsRels.usersId]: userId,
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
      const visitorId = getCurrentUserIdInt();
      if (!visitorId) return;

      // Mark all messages in conversation as read (except own messages)
      await supabase
        .from(DB.messages.table)
        .update({ [DB.messages.read]: true })
        .eq(DB.messages.conversationId, parseInt(conversationId))
        .neq(DB.messages.senderId, visitorId);
    } catch (error) {
      console.error("[Messages] markAsRead error:", error);
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
