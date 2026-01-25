/**
 * Messages API - handles chat messages with Bunny CDN media uploads
 */

import { createCollectionAPI, users } from "@/lib/api-client";
import { uploadToBunny } from "@/lib/bunny-storage";
import { useAuthStore } from "@/lib/stores/auth-store";

// Cache for Payload CMS user ID lookups
const payloadUserIdCache: Record<string, string> = {};

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

// Helper to get Payload CMS user ID by username
async function getPayloadUserId(username: string): Promise<string | null> {
  if (!username) return null;
  
  // Check cache first
  if (payloadUserIdCache[username]) {
    return payloadUserIdCache[username];
  }
  
  try {
    const result = await users.find({
      where: { username: { equals: username } },
      limit: 1,
    });
    
    if (result.docs && result.docs.length > 0) {
      const payloadId = (result.docs[0] as { id: string }).id;
      payloadUserIdCache[username] = payloadId;
      console.log("[messagesApi] Found Payload user ID for", username, "->", payloadId);
      return payloadId;
    }
  } catch (error) {
    console.error("[messagesApi] Error looking up Payload user ID:", error);
  }
  
  return null;
}

export const messagesApiClient = {
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
        console.error("[messagesApi] Could not find Payload user ID for:", user.username);
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

      console.log("[messagesApi] Sending message with Payload user ID:", payloadUserId);

      const doc = await messagesApi.create({
        conversation: data.conversationId,
        sender: payloadUserId, // Use Payload CMS user ID, not Better Auth ID
        content: data.content || "",
        media: mediaItems,
      });

      return transformMessage(doc);
    } catch (error) {
      console.error("[messagesApi] sendMessage error:", error);
      return null;
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
        console.error("[messagesApi] Could not find Payload user ID for:", user.username);
        throw new Error("User not found in system");
      }

      console.log("[messagesApi] Looking for conversation between", payloadUserId, "and", otherUserId);

      // Try to find existing conversation using Payload CMS user IDs
      const existing = await conversationsApi.find({
        where: {
          and: [
            { participants: { contains: payloadUserId } },
            { participants: { contains: otherUserId } },
            { isGroup: { equals: false } },
          ],
        },
        depth: 2,
      });

      if (existing.docs.length > 0) {
        console.log("[messagesApi] Found existing conversation:", existing.docs[0].id);
        return transformConversation(existing.docs[0]);
      }

      // Create new conversation with Payload CMS user IDs
      console.log("[messagesApi] Creating new conversation");
      const doc = await conversationsApi.create({
        participants: [payloadUserId, otherUserId],
        isGroup: false,
      });

      return transformConversation(doc);
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
        console.error("[messagesApi] Could not find Payload user ID for:", user.username);
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

  // Get unread message count across all conversations
  async getUnreadCount(): Promise<number> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return 0;

      // Get Payload CMS user ID
      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return 0;

      // Find all unread messages not sent by current user
      const unread = await messagesApi.find({
        where: {
          and: [
            { sender: { not_equals: payloadUserId } },
            { readAt: { exists: false } },
          ],
        },
        limit: 100,
      });

      return unread.totalDocs || unread.docs.length;
    } catch (error) {
      console.error("[messagesApi] getUnreadCount error:", error);
      return 0;
    }
  },
};
