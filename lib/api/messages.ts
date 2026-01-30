/**
 * Messages API - handles chat messages with Bunny CDN media uploads
 */

import { createCollectionAPI, users } from "@/lib/api-client";
import { uploadToBunny } from "@/lib/bunny-storage";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getPayloadUserId } from "@/lib/api/payload-user-id";

export interface MessageMedia {
  type: "image" | "video";
  url: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  media: MessageMedia[];
  createdAt: string;
  readAt?: string;
}

export interface Conversation {
  id: string;
  participants: Array<{
    id: string;
    username: string;
    avatar?: string;
    name?: string;
  }>;
  isGroup: boolean;
  groupName?: string;
  lastMessageAt?: string;
  createdAt: string;
}

const messagesApi = createCollectionAPI<Record<string, unknown>>("messages");
const conversationsApi =
  createCollectionAPI<Record<string, unknown>>("conversations");

// Transform API response to Message type
function transformMessage(doc: Record<string, unknown>): Message {
  const sender = doc.sender as Record<string, unknown> | undefined;

  return {
    id: String(doc.id),
    conversation: String(doc.conversation),
    sender: {
      id: String(sender?.id || ""),
      username: String(sender?.username || "user"),
      avatar: sender?.avatar as string | undefined,
    },
    content: String(doc.content || ""),
    media: ((doc.media as Array<Record<string, unknown>>) || []).map((m) => ({
      type: (m.type as "image" | "video") || "image",
      url: String(m.url || ""),
    })),
    createdAt: String(doc.createdAt || new Date().toISOString()),
    readAt: doc.readAt as string | undefined,
  };
}

// Transform API response to Conversation type
function transformConversation(doc: Record<string, unknown>): Conversation {
  return {
    id: String(doc.id),
    participants: (
      (doc.participants as Array<Record<string, unknown>>) || []
    ).map((p) => ({
      id: String(p.id || ""),
      username: String(p.username || "user"),
      avatar: p.avatar as string | undefined,
      name: p.name as string | undefined,
    })),
    isGroup: Boolean(doc.isGroup),
    groupName: doc.groupName as string | undefined,
    lastMessageAt: doc.lastMessageAt as string | undefined,
    createdAt: String(doc.createdAt || new Date().toISOString()),
  };
}

export const messagesApiClient = {
  // Get current user's following list for Inbox/Spam classification
  async getFollowingIds(): Promise<string[]> {
    try {
      const { users } = await import("@/lib/api-client");
      return await users.getFollowing();
    } catch (error) {
      console.error("[messagesApi] getFollowingIds error:", error);
      return [];
    }
  },

  // Get messages for a conversation
  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    try {
      const response = await messagesApi.find({
        limit,
        sort: "-createdAt",
        where: { conversation: { equals: conversationId } },
        depth: 2,
      });
      return response.docs.map(transformMessage).reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error("[messagesApi] getMessages error:", error);
      return [];
    }
  },

  // Send a message (with optional media upload to Bunny CDN)
  async sendMessage(data: {
    conversationId: string;
    content: string;
    media?: Array<{ uri: string; type: "image" | "video" }>;
  }): Promise<Message | null> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error("User must be logged in to send messages");
      }

      // CRITICAL: Get Payload CMS user ID by username (not Better Auth ID)
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) {
        console.error(
          "[messagesApi] Could not find Payload user ID for:",
          user.username,
        );
        throw new Error("User not found in system");
      }

      // Upload media to Bunny CDN if present
      let mediaItems: MessageMedia[] = [];
      if (data.media && data.media.length > 0) {
        console.log("[messagesApi] Uploading media to Bunny CDN...");
        for (const item of data.media) {
          const result = await uploadToBunny(
            item.uri,
            "messages",
            undefined,
            user.id,
          );
          if (result.success) {
            mediaItems.push({
              type: item.type,
              url: result.url,
            });
          } else {
            console.error("[messagesApi] Media upload failed:", result.error);
          }
        }
      }

      console.log(
        "[messagesApi] Sending message with Payload user ID:",
        payloadUserId,
      );

      const messagePayload = {
        conversation: data.conversationId,
        sender: payloadUserId, // Use Payload CMS user ID, not Better Auth ID
        content: data.content || "",
        media: mediaItems,
      };
      console.log(
        "[messagesApi] Message payload:",
        JSON.stringify(messagePayload),
      );

      const doc = await messagesApi.create(messagePayload);
      console.log("[messagesApi] Message created:", doc?.id || "no id");

      if (!doc || !doc.id) {
        throw new Error("Message creation failed - no document returned");
      }

      return transformMessage(doc);
    } catch (error: any) {
      console.error("[messagesApi] sendMessage error:", error?.message, error);
      // Re-throw with cleaner error message for UI
      if (error?.status === 401 || error?.message?.includes("Unauthorized")) {
        throw new Error("Please log in to send messages");
      }
      if (error?.status === 400) {
        throw new Error("Invalid message data");
      }
      throw new Error(error?.message || "Failed to send message");
    }
  },

  // Get or create a conversation with a user
  async getOrCreateConversation(
    otherUserId: string,
  ): Promise<Conversation | null> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error("User must be logged in");
      }

      // CRITICAL: Get Payload CMS user ID by username (not Better Auth ID)
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) {
        console.error(
          "[messagesApi] Could not find Payload user ID for:",
          user.username,
        );
        throw new Error("User not found in system");
      }

      // Check if otherUserId is a username or Payload ID
      // If it looks like a username (contains letters), convert to Payload ID
      let otherPayloadUserId = otherUserId;
      if (/^[a-zA-Z]/.test(otherUserId)) {
        // It's a username, convert to Payload ID
        const otherUserPayloadId = await getPayloadUserId(otherUserId);
        if (!otherUserPayloadId) {
          console.error(
            "[messagesApi] Could not find Payload user ID for other user:",
            otherUserId,
          );
          throw new Error("Other user not found in system");
        }
        otherPayloadUserId = otherUserPayloadId;
        console.log(
          "[messagesApi] Converted username",
          otherUserId,
          "to Payload ID:",
          otherPayloadUserId,
        );
      }

      console.log(
        "[messagesApi] Looking for conversation between",
        payloadUserId,
        "and",
        otherPayloadUserId,
      );

      // Try to find existing conversation using Payload CMS user IDs
      const existing = await conversationsApi.find({
        where: {
          and: [
            { participants: { contains: payloadUserId } },
            { participants: { contains: otherPayloadUserId } },
            { isGroup: { equals: false } },
          ],
        },
        depth: 2,
      });

      const directConversation = existing.docs.find((doc) => {
        const participants = (
          (doc.participants as Array<Record<string, unknown>>) || []
        ).map((p) => String(p.id || p));
        const normalizedIds = new Set(participants);
        return (
          normalizedIds.size === 2 &&
          normalizedIds.has(payloadUserId) &&
          normalizedIds.has(otherPayloadUserId)
        );
      });

      if (directConversation) {
        console.log(
          "[messagesApi] Found existing direct conversation:",
          directConversation.id,
        );
        return transformConversation(directConversation);
      }

      // Create new conversation with Payload CMS user IDs
      // CRITICAL: Payload relationship fields expect numeric IDs, not strings
      console.log("[messagesApi] Creating new conversation");
      const participantsArray = [
        Number(payloadUserId),
        Number(otherPayloadUserId),
      ].filter((id) => !isNaN(id) && id > 0);
      console.log(
        "[messagesApi] Creating conversation participants:",
        participantsArray,
      );

      if (participantsArray.length !== 2) {
        console.error("[messagesApi] Invalid participant IDs:", {
          payloadUserId,
          otherPayloadUserId,
        });
        throw new Error("Invalid participant IDs for conversation");
      }

      const doc = await conversationsApi.create({
        participants: participantsArray,
        isGroup: false,
      });

      console.log(
        "[messagesApi] Created conversation response:",
        JSON.stringify(doc),
      );

      // Payload CMS create returns { doc: {...} } wrapper in some cases
      const conversationDoc = (doc as any).doc || doc;
      console.log("[messagesApi] Conversation doc id:", conversationDoc?.id);

      return transformConversation(conversationDoc);
    } catch (error) {
      console.error("[messagesApi] getOrCreateConversation error:", error);
      return null;
    }
  },

  // Get user's conversations
  async getConversations(): Promise<Conversation[]> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return [];

      // Get Payload CMS user ID
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) {
        console.error(
          "[messagesApi] Could not find Payload user ID for:",
          user.username,
        );
        return [];
      }

      const response = await conversationsApi.find({
        limit: 50,
        sort: "-lastMessageAt",
        where: { participants: { contains: payloadUserId } },
        depth: 2,
      });

      return response.docs.map(transformConversation);
    } catch (error) {
      console.error("[messagesApi] getConversations error:", error);
      return [];
    }
  },

  // Get conversations filtered by follow status (Inbox = followed, Spam = not followed)
  async getFilteredConversations(
    type: "inbox" | "spam",
  ): Promise<Conversation[]> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return [];

      // Get all conversations and following list in parallel
      const [allConversations, followingIds] = await Promise.all([
        this.getConversations(),
        this.getFollowingIds(),
      ]);

      console.log("[messagesApi] Filtering conversations:", {
        type,
        totalConversations: allConversations.length,
        followingCount: followingIds.length,
      });

      // Filter based on whether the other participant is followed
      return allConversations.filter((conv) => {
        // Find the other participant (not current user)
        const otherParticipant = conv.participants.find(
          (p) => p.username !== user.username,
        );

        if (!otherParticipant) return false;

        const isFollowed = followingIds.includes(otherParticipant.id);

        // Inbox = conversations with users I follow
        // Spam = conversations with users I don't follow
        return type === "inbox" ? isFollowed : !isFollowed;
      });
    } catch (error) {
      console.error("[messagesApi] getFilteredConversations error:", error);
      return [];
    }
  },

  // Mark messages as read
  async markAsRead(conversationId: string): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      // Get Payload CMS user ID
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return;

      // Find unread messages in this conversation not sent by current user
      const unread = await messagesApi.find({
        where: {
          and: [
            { conversation: { equals: conversationId } },
            { sender: { not_equals: payloadUserId } },
            { readAt: { exists: false } },
          ],
        },
      });

      // Mark each as read
      for (const msg of unread.docs) {
        await messagesApi.update(String(msg.id), {
          readAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[messagesApi] markAsRead error:", error);
    }
  },

  // Get unread message count for INBOX ONLY (messages from followed users)
  // This is the source of truth for the Messages badge
  async getUnreadCount(): Promise<number> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return 0;

      // Get Payload CMS user ID
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return 0;

      // Get following list to filter Inbox-only messages
      const followingIds = await this.getFollowingIds();

      // Find all unread messages not sent by current user
      const unread = await messagesApi.find({
        where: {
          and: [
            { sender: { not_equals: payloadUserId } },
            { readAt: { exists: false } },
          ],
        },
        limit: 100,
        depth: 2,
      });

      // Filter to only count messages from followed users (Inbox only)
      // Spam messages should NOT increment the Messages badge
      let inboxUnreadCount = 0;
      for (const msg of unread.docs) {
        const sender = msg.sender as Record<string, unknown> | undefined;
        const senderId = String(sender?.id || "");

        // Only count if sender is in following list (Inbox)
        if (followingIds.includes(senderId)) {
          inboxUnreadCount++;
        }
      }

      console.log("[messagesApi] getUnreadCount:", {
        totalUnread: unread.docs.length,
        inboxUnread: inboxUnreadCount,
        followingCount: followingIds.length,
      });

      return inboxUnreadCount;
    } catch (error) {
      console.error("[messagesApi] getUnreadCount error:", error);
      return 0;
    }
  },

  // Get unread count for spam messages (non-followed users) - for UI display only
  async getSpamUnreadCount(): Promise<number> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return 0;

      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return 0;

      const followingIds = await this.getFollowingIds();

      const unread = await messagesApi.find({
        where: {
          and: [
            { sender: { not_equals: payloadUserId } },
            { readAt: { exists: false } },
          ],
        },
        limit: 100,
        depth: 2,
      });

      // Count only messages from NON-followed users (Spam)
      let spamUnreadCount = 0;
      for (const msg of unread.docs) {
        const sender = msg.sender as Record<string, unknown> | undefined;
        const senderId = String(sender?.id || "");

        if (!followingIds.includes(senderId)) {
          spamUnreadCount++;
        }
      }

      return spamUnreadCount;
    } catch (error) {
      console.error("[messagesApi] getSpamUnreadCount error:", error);
      return 0;
    }
  },
};
