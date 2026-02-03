import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";

export const messagesApi = {
  /**
   * Get conversations list
   */
  async getConversations() {
    try {
      console.log("[Messages] getConversations");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return [];

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
        .eq(DB.conversationsRels.usersId, userData[DB.users.id])
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
            .neq(DB.conversationsRels.usersId, userData[DB.users.id])
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

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return [];

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
        sender:
          msg[DB.messages.senderId] === userData[DB.users.id]
            ? "user"
            : "other",
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

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error("User not found");

      const { data: result, error } = await supabase
        .from(DB.messages.table)
        .insert({
          [DB.messages.conversationId]: parseInt(data.conversationId),
          [DB.messages.senderId]: userData[DB.users.id],
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error("User not found");

      // Check if conversation exists between these two users
      const { data: existingConvs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, userData[DB.users.id]);

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
          [DB.conversationsRels.usersId]: userData[DB.users.id],
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return 0;

      // Get conversations where user is a participant
      const { data: convs } = await supabase
        .from(DB.conversationsRels.table)
        .select(DB.conversationsRels.parentId)
        .eq(DB.conversationsRels.usersId, userData[DB.users.id]);

      if (!convs || convs.length === 0) return 0;

      // Count unread messages in these conversations
      const convIds = convs.map((c) => c[DB.conversationsRels.parentId]);
      const { count, error } = await supabase
        .from(DB.messages.table)
        .select("*", { count: "exact", head: true })
        .in(DB.messages.conversationId, convIds)
        .eq(DB.messages.read, false)
        .neq(DB.messages.senderId, userData[DB.users.id]);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error("[Messages] getUnreadCount error:", error);
      return 0;
    }
  },

  /**
   * Get spam unread message count (from non-followed users)
   */
  async getSpamUnreadCount() {
    try {
      // TODO: Implement when following table is available
      console.log(
        "[Messages] getSpamUnreadCount - returning 0 (not yet implemented)",
      );
      return 0;
    } catch (error) {
      console.error("[Messages] getSpamUnreadCount error:", error);
      return 0;
    }
  },

  /**
   * Create a group conversation
   */
  async createGroupConversation(participantIds: string[], groupName: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error("User not found");

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
      const allParticipants = [
        ...new Set([...participantIds, String(userData[DB.users.id])]),
      ];

      const participantInserts = allParticipants.map((userId) => ({
        [DB.conversationsRels.parentId]: conversation[DB.conversations.id],
        [DB.conversationsRels.usersId]: parseInt(userId),
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
   * Get IDs of users the current user is following
   */
  async getFollowingIds(): Promise<string[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return [];

      const { data, error } = await supabase
        .from(DB.follows.table)
        .select(DB.follows.followingId)
        .eq(DB.follows.followerId, userData[DB.users.id]);

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
