import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";

// Type exports for activity-store compatibility
export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "event_invite"
  | "event_update"
  | "message";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  content?: string;
  entityType?: string;
  entityId?: string;
  sender?: {
    id: string;
    username: string;
    avatar: string;
  } | null;
  actor?: {
    id: string;
    username: string;
    avatar: string;
  } | null;
  post?: {
    id: string;
    thumbnail?: string;
  } | null;
  event?: {
    id: string;
    title?: string;
  } | null;
  postId: string | null;
  commentId: string | null;
}

export const notificationsApi = {
  /**
   * Get notifications for current user
   * DB schema: recipient_id (int), actor_id (int) → users(id), type enum, entity_type enum, entity_id varchar, read_at timestamp
   */
  async getNotifications(limit: number = 50) {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) return { docs: [], totalDocs: 0 };

      const { data, error, count } = await supabase
        .from("notifications")
        .select(
          `
          id,
          type,
          entity_type,
          entity_id,
          read_at,
          created_at,
          actor:actor_id(
            id,
            username,
            avatar:avatar_id(url)
          )
        `,
          { count: "exact" },
        )
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(
          "[Notifications] getNotifications error:",
          error.message,
          error.details,
          error.hint,
        );
        return { docs: [], totalDocs: 0 };
      }

      console.log(
        "[Notifications] Raw data count:",
        data?.length,
        "for userId:",
        userId,
      );
      if (data?.length) {
        console.log(
          "[Notifications] Types:",
          data.map((n: any) => n.type).join(", "),
        );
      }

      const docs = (data || []).map((n: any) => ({
        id: String(n.id),
        type: n.type,
        message: "",
        read: !!n.read_at,
        readAt: n.read_at || undefined,
        createdAt: n.created_at,
        entityType: n.entity_type || undefined,
        entityId: n.entity_id || undefined,
        sender: n.actor
          ? {
              id: String(n.actor.id),
              username: n.actor.username,
              avatar: n.actor.avatar?.url || "",
            }
          : null,
        actor: n.actor
          ? {
              id: String(n.actor.id),
              username: n.actor.username,
              avatar: n.actor.avatar?.url || "",
            }
          : null,
        postId: n.entity_type === "post" ? n.entity_id : null,
        commentId: n.entity_type === "comment" ? n.entity_id : null,
      }));

      return { docs, totalDocs: count || 0 };
    } catch (error) {
      console.error("[Notifications] getNotifications error:", error);
      return { docs: [], totalDocs: 0 };
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", parseInt(notificationId));

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[Notifications] markAsRead error:", error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", userId)
        .is("read_at", null);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("[Notifications] markAllAsRead error:", error);
      throw error;
    }
  },

  /**
   * Get notifications (alias for getNotifications)
   */
  async get(options: { limit?: number } = {}) {
    return this.getNotifications(options.limit || 50);
  },

  /**
   * Get notification badges/counts
   */
  async getBadges() {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) return { unread: 0, total: 0 };

      const { count: unread } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);

      return { unread: unread || 0, total: 0 };
    } catch (error) {
      console.error("[Notifications] getBadges error:", error);
      return { unread: 0, total: 0 };
    }
  },
};

// Alias for backward compatibility with activity-store
export const notificationsApiClient = {
  get: async (options: { limit?: number } = {}) =>
    notificationsApi.getNotifications(options.limit || 50),
  getNotifications: (limit?: number) =>
    notificationsApi.getNotifications(limit || 50),
  markAsRead: (id: string) => notificationsApi.markAsRead(id),
  markAllAsRead: () => notificationsApi.markAllAsRead(),
  getBadges: () => notificationsApi.getBadges(),
  formatTimeAgo: (dateString: string): string => {
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
  },
};
