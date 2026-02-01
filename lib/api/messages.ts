/**
 * Messages API - handles chat messages with Bunny CDN media uploads
 */

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
  
  // Get current user from auth store
  const currentUser = useAuthStore.getState().user;
  
  // If looking up current user, return their ID from session
  if (currentUser && currentUser.username === username) {
    const payloadId = currentUser.id;
    payloadUserIdCache[username] = payloadId;
    console.log("[messagesApi] Using current user Payload ID:", username, "->", payloadId);
    return payloadId;
  }
  
  // For other users, use profile endpoint (custom endpoint returns JSON)
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error("[messagesApi] EXPO_PUBLIC_API_URL not configured");
      return null;
    }

    const { getAuthToken } = await import("@/lib/auth-client");
    const token = await getAuthToken();
    
    const response = await fetch(
      `${apiUrl}/api/users/${username}/profile`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      }
    );
    
    if (!response.ok) {
      console.error("[messagesApi] Profile lookup failed:", response.status);
      return null;
    }
    
    const profile = await response.json();
    if (profile && profile.id) {
      const payloadId = String(profile.id);
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
  // Get messages for a conversation (uses custom endpoint)
  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const { getAuthToken } = await import("@/lib/auth-client");
      const token = await getAuthToken();
      
      const response = await fetch(
        `${apiUrl}/api/conversations/${conversationId}/messages?limit=${limit}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[messagesApi] getMessages failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformMessage).reverse();
    } catch (error) {
      console.error("[messagesApi] getMessages error:", error);
      return [];
    }
  },

  // Send a message (uses custom endpoint)
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

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const { getAuthToken } = await import("@/lib/auth-client");
      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/conversations/${data.conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: data.content || "",
            media: mediaItems,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const doc = await response.json();
      return transformMessage(doc);
    } catch (error) {
      console.error("[messagesApi] sendMessage error:", error);
      return null;
    }
  },

  // Get or create a conversation with a user (uses custom endpoint)
  async getOrCreateConversation(
    otherUserId: string,
  ): Promise<Conversation | null> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error("User must be logged in");
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const { getAuthToken } = await import("@/lib/auth-client");
      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/conversations/direct`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            otherUserId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get/create conversation: ${response.status}`);
      }

      const doc = await response.json();
      return transformConversation(doc);
    } catch (error) {
      console.error("[messagesApi] getOrCreateConversation error:", error);
      return null;
    }
  },

  // Get user's conversations (uses custom endpoint)
  async getConversations(): Promise<Conversation[]> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return [];

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const { getAuthToken } = await import("@/lib/auth-client");
      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/conversations?box=all&limit=50`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[messagesApi] getConversations failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformConversation);
    } catch (error) {
      console.error("[messagesApi] getConversations error:", error);
      return [];
    }
  },

  // Mark messages as read
  async markAsRead(conversationId: string): Promise<void> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return;

      const { getAuthToken } = await import("@/lib/auth-client");
      const token = await getAuthToken();

      await fetch(
        `${apiUrl}/api/conversations/${conversationId}/mark-read`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );
    } catch (error) {
      console.error("[messagesApi] markAsRead error:", error);
    }
  },

  // Get unread message count across all conversations
  async getUnreadCount(): Promise<number> {
    try {
      const conversations = await this.getConversations();
      // Count conversations with unread messages (simplified)
      // In production, you'd want a dedicated endpoint for this
      return conversations.filter((c) => c.lastMessageAt).length;
    } catch (error) {
      console.error("[messagesApi] getUnreadCount error:", error);
      return 0;
    }
  },
};
