import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";

export const notificationsApi = {
  /**
   * Get notifications for current user
   */
  async getNotifications(limit: number = 50) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { docs: [], totalDocs: 0 };

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return { docs: [], totalDocs: 0 };

      // Note: This assumes a 'notifications' table exists
      const { data, error, count } = await supabase
        .from("notifications")
        .select(
          `
          *,
          actor:actor_id(
            id,
            username,
            avatar:avatar_id(url)
          )
        `,
          { count: "exact" },
        )
        .eq("user_id", userData[DB.users.id])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.log(
          "[Notifications] getNotifications - table may not exist:",
          error.message,
        );
        return { docs: [], totalDocs: 0 };
      }

      const docs = (data || []).map((n: any) => ({
        id: String(n.id),
        type: n.type,
        message: n.message,
        read: n.read || false,
        createdAt: n.created_at,
        actor: n.actor
          ? {
              id: String(n.actor.id),
              username: n.actor.username,
              avatar: n.actor.avatar?.url || "",
            }
          : null,
        postId: n.post_id ? String(n.post_id) : null,
        commentId: n.comment_id ? String(n.comment_id) : null,
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
        .update({ read: true })
        .eq("id", notificationId);

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

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userData[DB.users.id]);

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { unread: 0, total: 0 };

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return { unread: 0, total: 0 };

      const { count: unread } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userData[DB.users.id])
        .eq("read", false);

      return { unread: unread || 0, total: 0 };
    } catch (error) {
      console.error("[Notifications] getBadges error:", error);
      return { unread: 0, total: 0 };
    }
  },
};
