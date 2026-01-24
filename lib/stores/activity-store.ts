import { create } from "zustand";

interface Activity {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
  user: {
    username: string;
    avatar: string;
  };
  post?: {
    id: string;
    thumbnail: string;
  };
  comment?: string;
  timeAgo: string;
  isRead: boolean;
}

// TODO: Replace with real activities from backend
const initialActivities: Activity[] = [];

interface ActivityState {
  activities: Activity[];
  refreshing: boolean;
  followedUsers: Set<string>;

  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;
  setRefreshing: (refreshing: boolean) => void;
  toggleFollowUser: (username: string) => void;
  isUserFollowed: (username: string) => boolean;
  markActivityAsRead: (activityId: string) => void;
  markAllAsRead: () => void;
  loadInitialActivities: () => void;
  getUnreadCount: () => number;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  refreshing: false,
  followedUsers: new Set<string>(),

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({
      activities: [activity, ...state.activities],
    })),

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

  markActivityAsRead: (activityId) =>
    set((state) => ({
      activities: state.activities.map((a) =>
        a.id === activityId ? { ...a, isRead: true } : a,
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      activities: state.activities.map((a) => ({ ...a, isRead: true })),
    })),

  loadInitialActivities: () => set({ activities: initialActivities }),

  getUnreadCount: () => get().activities.filter((a) => !a.isRead).length,
}));

export type { Activity };
