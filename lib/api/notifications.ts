/**
 * Notifications API Client
 * 
 * Handles fetching and managing notifications from the backend.
 * These notifications are for the Activity feed (likes, follows, comments, mentions).
 * 
 * CRITICAL: Message notifications are EXCLUDED from this count.
 * Messages are handled separately via messagesApiClient.
 */

import { createCollectionAPI, users } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

// Notification types for Activity feed (excludes 'message')
export type NotificationType = 
  | "like" 
  | "comment" 
  | "follow" 
  | "mention" 
  | "event_invite" 
  | "event_update";

export interface Notification {
  id: string;
  type: NotificationType;
  recipient: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
    name?: string;
  };
  // Entity reference for routing
  entityType?: "post" | "comment" | "user" | "event";
  entityId?: string;
  // Additional data
  post?: {
    id: string;
    thumbnail?: string;
  };
  event?: {
    id: string;
    title?: string;
  };
  content?: string; // For comments/mentions
  readAt?: string;
  createdAt: string;
}

// Cache for Payload CMS user ID lookups
const payloadUserIdCache: Record<string, string> = {};

const notificationsApi = createCollectionAPI<Record<string, unknown>>("notifications");

// Helper to get Payload CMS user ID by username
async function getPayloadUserId(username: string): Promise<string | null> {
  if (!username) return null;

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
      return payloadId;
    }
  } catch (error) {
    console.error("[notificationsApi] Error looking up Payload user ID:", error);
  }

  return null;
}

// Transform API response to Notification type
function transformNotification(doc: Record<string, unknown>): Notification {
  const sender = doc.sender as Record<string, unknown> | undefined;
  const post = doc.post as Record<string, unknown> | undefined;
  const event = doc.event as Record<string, unknown> | undefined;

  return {
    id: String(doc.id),
    type: (doc.type as NotificationType) || "like",
    recipient: String(doc.recipient || ""),
    sender: {
      id: String(sender?.id || ""),
      username: String(sender?.username || "user"),
      avatar: sender?.avatar as string | undefined,
      name: sender?.name as string | undefined,
    },
    entityType: doc.entityType as "post" | "comment" | "user" | "event" | undefined,
    entityId: doc.entityId as string | undefined,
    post: post ? {
      id: String(post.id || ""),
      thumbnail: post.thumbnail as string | undefined,
    } : undefined,
    event: event ? {
      id: String(event.id || ""),
      title: event.title as string | undefined,
    } : undefined,
    content: doc.content as string | undefined,
    readAt: doc.readAt as string | undefined,
    createdAt: String(doc.createdAt || new Date().toISOString()),
  };
}

// Format time ago helper
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export const notificationsApiClient = {
  /**
   * Get notifications for current user
   * EXCLUDES 'message' type notifications
   */
  async getNotifications(limit = 50, page = 1): Promise<Notification[]> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return [];

      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return [];

      const response = await notificationsApi.find({
        limit,
        page,
        sort: "-createdAt",
        where: {
          and: [
            { recipient: { equals: payloadUserId } },
            // CRITICAL: Exclude 'message' type - messages are handled separately
            { type: { not_equals: "message" } },
          ],
        },
        depth: 2,
      });

      console.log("[notificationsApi] getNotifications:", {
        count: response.docs.length,
        page,
      });

      return response.docs.map(transformNotification);
    } catch (error) {
      console.error("[notificationsApi] getNotifications error:", error);
      return [];
    }
  },

  /**
   * Get unread notifications count
   * EXCLUDES 'message' type - messages have their own separate count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return 0;

      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return 0;

      const response = await notificationsApi.find({
        limit: 100,
        where: {
          and: [
            { recipient: { equals: payloadUserId } },
            { readAt: { exists: false } },
            // CRITICAL: Exclude 'message' type
            { type: { not_equals: "message" } },
          ],
        },
      });

      const count = response.totalDocs || response.docs.length;
      console.log("[notificationsApi] getUnreadCount:", count);
      return count;
    } catch (error) {
      console.error("[notificationsApi] getUnreadCount error:", error);
      return 0;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await notificationsApi.update(notificationId, {
        readAt: new Date().toISOString(),
      });
      console.log("[notificationsApi] markAsRead:", notificationId);
      return true;
    } catch (error) {
      console.error("[notificationsApi] markAsRead error:", error);
      return false;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return false;

      const payloadUserId = await getPayloadUserId(user.username);
      if (!payloadUserId) return false;

      // Get all unread notifications
      const unread = await notificationsApi.find({
        limit: 100,
        where: {
          and: [
            { recipient: { equals: payloadUserId } },
            { readAt: { exists: false } },
            { type: { not_equals: "message" } },
          ],
        },
      });

      // Mark each as read
      const now = new Date().toISOString();
      for (const doc of unread.docs) {
        await notificationsApi.update(String(doc.id), { readAt: now });
      }

      console.log("[notificationsApi] markAllAsRead:", unread.docs.length);
      return true;
    } catch (error) {
      console.error("[notificationsApi] markAllAsRead error:", error);
      return false;
    }
  },

  /**
   * Get the correct route for a notification based on entityType/entityId
   */
  getRouteForNotification(notification: Notification): string {
    const { type, entityType, entityId, post, event, sender } = notification;

    // Use entityType/entityId if available (preferred)
    if (entityType && entityId) {
      switch (entityType) {
        case "post":
          return `/(protected)/post/${entityId}`;
        case "comment":
          // Comments route to post with comment focus
          return `/(protected)/post/${entityId}`;
        case "user":
          return `/(protected)/profile/${entityId}`;
        case "event":
          return `/(protected)/events/${entityId}`;
      }
    }

    // Fallback to type-based routing
    switch (type) {
      case "like":
      case "comment":
      case "mention":
        if (post?.id) {
          return `/(protected)/post/${post.id}`;
        }
        break;
      case "follow":
        return `/(protected)/profile/${sender.username}`;
      case "event_invite":
      case "event_update":
        if (event?.id) {
          return `/(protected)/events/${event.id}`;
        }
        break;
    }

    // Default to user profile
    return `/(protected)/profile/${sender.username}`;
  },

  // Helper to format notification for Activity store
  formatTimeAgo,
};
