/**
 * Messages API - Re-exports from Supabase messages API
 * This file maintains backwards compatibility with existing imports
 */

import { messagesApi } from "./supabase-messages";
import { uploadToServer } from "@/lib/server-upload";

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

// Re-export Supabase messages API as messagesApiClient for backwards compatibility
export const messagesApiClient = {
  // Get messages for a conversation
  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const messages = await messagesApi.getMessages(conversationId, limit);
    return messages.map((m: any) => ({
      id: m.id,
      conversation: conversationId,
      sender: {
        id: m.sender === "user" ? "current" : "other",
        username: "",
        avatar: "",
      },
      content: m.text,
      media: [],
      createdAt: m.timestamp,
    }));
  },

  // Send a message
  async sendMessage(data: {
    conversationId: string;
    content: string;
    media?: Array<{ uri: string; type: "image" | "video" }>;
  }): Promise<Message | null> {
    // Upload media if present
    let mediaItems: MessageMedia[] = [];
    if (data.media && data.media.length > 0) {
      console.log("[messagesApiClient] Uploading media via server...");
      for (const item of data.media) {
        const result = await uploadToServer(item.uri, "messages");
        if (result.success && result.url) {
          mediaItems.push({ type: item.type, url: result.url });
        }
      }
    }

    const result = await messagesApi.sendMessage({
      conversationId: data.conversationId,
      content: data.content,
    });

    if (!result) return null;

    return {
      id: String(result.id || Date.now()),
      conversation: data.conversationId,
      sender: { id: "current", username: "", avatar: "" },
      content: data.content,
      media: mediaItems,
      createdAt: new Date().toISOString(),
    };
  },

  // Get or create a conversation with a user
  async getOrCreateConversation(
    otherUserId: string,
  ): Promise<Conversation | null> {
    const conversationId =
      await messagesApi.getOrCreateConversation(otherUserId);
    if (!conversationId) return null;

    return {
      id: conversationId,
      participants: [{ id: otherUserId, username: "", avatar: "" }],
      isGroup: false,
      createdAt: new Date().toISOString(),
    };
  },

  // Get user's conversations
  async getConversations(): Promise<Conversation[]> {
    const conversations = await messagesApi.getConversations();
    return conversations.map((c: any) => ({
      id: c.id,
      participants: [
        {
          id: c.user?.username || "",
          username: c.user?.username || "",
          avatar: c.user?.avatar || "",
          name: c.user?.name || "",
        },
      ],
      isGroup: false,
      lastMessageAt: c.timestamp,
      createdAt: c.timestamp || new Date().toISOString(),
    }));
  },

  // Get following IDs for the current user
  async getFollowingIds(): Promise<string[]> {
    return messagesApi.getFollowingIds();
  },

  // Get conversations filtered by follow status
  async getFilteredConversations(
    type: "inbox" | "spam",
  ): Promise<Conversation[]> {
    const [allConversations, followingIds] = await Promise.all([
      this.getConversations(),
      this.getFollowingIds(),
    ]);

    return allConversations.filter((conv) => {
      const otherParticipant = conv.participants[0];
      if (!otherParticipant) return false;
      const isFollowed = followingIds.includes(otherParticipant.id);
      return type === "inbox" ? isFollowed : !isFollowed;
    });
  },

  // Mark messages as read (placeholder - implement in supabase-messages if needed)
  async markAsRead(_conversationId: string): Promise<void> {
    console.log(
      "[messagesApiClient] markAsRead - not yet implemented in Supabase",
    );
  },

  // Get unread message count
  async getUnreadCount(): Promise<number> {
    return messagesApi.getUnreadCount();
  },

  // Get unread count for spam messages
  async getSpamUnreadCount(): Promise<number> {
    return messagesApi.getSpamUnreadCount();
  },
};
