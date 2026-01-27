import { create } from "zustand";
import {
  notificationsApiClient,
  type Notification,
  type NotificationType,
} from "@/lib/api/notifications";
import { useUnreadCountsStore } from "@/lib/stores/unread-counts-store";

// Activity types (excludes 'message' - messages are handled separately)
export type ActivityType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "event_invite"
  | "event_update";

export interface Activity {
  id: string;
  type: ActivityType;
  user: {
    id?: string;
    username: string;
    avatar: string;
  };
  // Entity reference for correct routing
  entityType?: "post" | "comment" | "user" | "event";
  entityId?: string;
  post?: {
    id: string;
    thumbnail: string;
  };
  event?: {
    id: string;
    title?: string;
  };
  comment?: string;
  timeAgo: string;
  isRead: boolean;
  createdAt?: string;
}

interface ActivityState {
  activities: Activity[];
  refreshing: boolean;
  isLoading: boolean;
  followedUsers: Set<string>;
  lastFetchTime: number;

  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;
  setRefreshing: (refreshing: boolean) => void;
  toggleFollowUser: (username: string) => void;
  isUserFollowed: (username: string) => boolean;
  markActivityAsRead: (activityId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadInitialActivities: () => void;
  fetchFromBackend: () => Promise<void>;
  getUnreadCount: () => number;
  getRouteForActivity: (activity: Activity) => string;
  syncUnreadCount: () => void;
  reset: () => void;
}

// Transform backend notification to Activity format
// DEFENSIVE: Never crash on malformed data
function notificationToActivity(notif: Notification): Activity | null {
  try {
    if (!notif || !notif.id) return null;

    const senderUsername = notif.sender?.username || "user";

    return {
      id: String(notif.id),
      type: (notif.type as ActivityType) || "like",
      user: {
        id: notif.sender?.id || "",
        username: senderUsername,
        avatar:
          notif.sender?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(senderUsername)}&background=3EA4E5&color=fff`,
      },
      entityType: notif.entityType,
      entityId: notif.entityId,
      post: notif.post
        ? {
            id: String(notif.post.id || ""),
            thumbnail: notif.post.thumbnail || "",
          }
        : undefined,
      event: notif.event
        ? {
            id: String(notif.event.id || ""),
            title: notif.event.title,
          }
        : undefined,
      comment: notif.content,
      timeAgo: notificationsApiClient.formatTimeAgo(
        notif.createdAt || new Date().toISOString(),
      ),
      isRead: !!notif.readAt,
      createdAt: notif.createdAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "[ActivityStore] notificationToActivity error:",
      error,
      notif,
    );
    return null;
  }
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  refreshing: false,
  isLoading: false,
  followedUsers: new Set<string>(),
  lastFetchTime: 0,

  setActivities: (activities) => {
    set({ activities });
    get().syncUnreadCount();
  },

  addActivity: (activity) => {
    set((state) => ({
      activities: [activity, ...state.activities],
    }));
    get().syncUnreadCount();
  },

  setRefreshing: (refreshing) => set({ refreshing }),

  toggleFollowUser: (username) =>
    set((state) => {
      const newFollowedUsers = new Set(state.followedUsers);
      if (newFollowedUsers.has(username)) {
        newFollowedUsers.delete(username);
      } else {
        newFollowedUsers.add(username);
      }
      return { followedUsers: newFollowedUsers };
    }),

  isUserFollowed: (username) => get().followedUsers.has(username),

  // Mark single activity as read - persists to backend
  markActivityAsRead: async (activityId) => {
    // Optimistic update
    set((state) => ({
      activities: state.activities.map((a) =>
        a.id === activityId ? { ...a, isRead: true } : a,
      ),
    }));
    get().syncUnreadCount();

    // Persist to backend
    try {
      await notificationsApiClient.markAsRead(activityId);
      console.log("[ActivityStore] Marked as read:", activityId);
    } catch (error) {
      console.error("[ActivityStore] Failed to mark as read:", error);
    }
  },

  // Mark all activities as read - persists to backend
  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      activities: state.activities.map((a) => ({ ...a, isRead: true })),
    }));
    get().syncUnreadCount();

    // Persist to backend
    try {
      await notificationsApiClient.markAllAsRead();
      console.log("[ActivityStore] Marked all as read");
    } catch (error) {
      console.error("[ActivityStore] Failed to mark all as read:", error);
    }
  },

  // Load initial activities (triggers backend fetch)
  loadInitialActivities: () => {
    get().fetchFromBackend();
  },

  // Fetch notifications from backend
  fetchFromBackend: async () => {
    const { isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true });
    try {
      const notifications = await notificationsApiClient.getNotifications(50);
      // DEFENSIVE: Filter out null values from failed transformations
      const activities = notifications
        .map(notificationToActivity)
        .filter((a): a is Activity => a !== null);

      console.log("[ActivityStore] Fetched from backend:", {
        count: activities.length,
        unread: activities.filter((a) => !a.isRead).length,
      });

      set({
        activities,
        lastFetchTime: Date.now(),
        isLoading: false,
      });
      get().syncUnreadCount();
    } catch (error) {
      console.error("[ActivityStore] fetchFromBackend error:", error);
      set({ isLoading: false });
    }
  },

  getUnreadCount: () => get().activities.filter((a) => !a.isRead).length,

  // Get the correct route for an activity item
  getRouteForActivity: (activity) => {
    const { type, entityType, entityId, post, event, user } = activity;

    // Use entityType/entityId if available (preferred routing)
    if (entityType && entityId) {
      switch (entityType) {
        case "post":
          return `/(protected)/post/${entityId}`;
        case "comment":
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
        return `/(protected)/profile/${user.username}`;
      case "follow":
        return `/(protected)/profile/${user.username}`;
      case "event_invite":
      case "event_update":
        if (event?.id) {
          return `/(protected)/events/${event.id}`;
        }
        return `/(protected)/events`;
    }

    // Default fallback
    return `/(protected)/profile/${user.username}`;
  },

  // Sync unread count to the unified store
  syncUnreadCount: () => {
    const unreadCount = get().getUnreadCount();
    useUnreadCountsStore.getState().setNotificationsUnread(unreadCount);
    console.log("[ActivityStore] syncUnreadCount:", unreadCount);
  },

  reset: () => {
    set({
      activities: [],
      refreshing: false,
      isLoading: false,
      followedUsers: new Set<string>(),
      lastFetchTime: 0,
    });
    useUnreadCountsStore.getState().setNotificationsUnread(0);
  },
}));
