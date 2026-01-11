import { create } from "zustand"

interface Activity {
  id: string
  type: "like" | "comment" | "follow" | "mention"
  user: { 
    username: string
    avatar: string 
  }
  post?: { 
    id: string
    thumbnail: string 
  }
  comment?: string
  timeAgo: string
  isRead: boolean
}

const initialActivities: Activity[] = [
  {
    id: "1",
    type: "like",
    user: { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5" },
    post: { id: "f1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    timeAgo: "2h",
    isRead: false,
  },
  {
    id: "2",
    type: "comment",
    user: { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17" },
    post: { id: "f2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
    comment: "Amazing shot! 🔥",
    timeAgo: "4h",
    isRead: false,
  },
  {
    id: "3",
    type: "follow",
    user: { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14" },
    timeAgo: "1d",
    isRead: true,
  },
  {
    id: "4",
    type: "like",
    user: { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15" },
    post: { id: "f3", thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800" },
    timeAgo: "2d",
    isRead: true,
  },
  {
    id: "5",
    type: "mention",
    user: { username: "travel_with_me", avatar: "https://i.pravatar.cc/150?img=10" },
    post: { id: "f4", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800" },
    comment: "Check out @alex.creator's work!",
    timeAgo: "3d",
    isRead: true,
  },
  {
    id: "6",
    type: "comment",
    user: { username: "naturephoto", avatar: "https://i.pravatar.cc/150?img=13" },
    post: { id: "f1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    comment: "The colors are incredible!",
    timeAgo: "4d",
    isRead: true,
  },
  {
    id: "7",
    type: "follow",
    user: { username: "urban_explorer", avatar: "https://i.pravatar.cc/150?img=8" },
    timeAgo: "5d",
    isRead: true,
  },
  {
    id: "8",
    type: "like",
    user: { username: "foodie_adventures", avatar: "https://i.pravatar.cc/150?img=9" },
    post: { id: "f2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
    timeAgo: "1w",
    isRead: true,
  },
]

interface ActivityState {
  activities: Activity[]
  refreshing: boolean
  followedUsers: Set<string>
  
  setActivities: (activities: Activity[]) => void
  setRefreshing: (refreshing: boolean) => void
  toggleFollowUser: (username: string) => void
  isUserFollowed: (username: string) => boolean
  markActivityAsRead: (activityId: string) => void
  markAllAsRead: () => void
  loadInitialActivities: () => void
  getUnreadCount: () => number
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  refreshing: false,
  followedUsers: new Set<string>(),

  setActivities: (activities) => set({ activities }),

  setRefreshing: (refreshing) => set({ refreshing }),

  toggleFollowUser: (username) =>
    set((state) => {
      const newFollowedUsers = new Set(state.followedUsers)
      if (newFollowedUsers.has(username)) {
        newFollowedUsers.delete(username)
      } else {
        newFollowedUsers.add(username)
      }
      return { followedUsers: newFollowedUsers }
    }),

  isUserFollowed: (username) => get().followedUsers.has(username),

  markActivityAsRead: (activityId) =>
    set((state) => ({
      activities: state.activities.map((a) =>
        a.id === activityId ? { ...a, isRead: true } : a
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      activities: state.activities.map((a) => ({ ...a, isRead: true })),
    })),

  loadInitialActivities: () => set({ activities: initialActivities }),

  getUnreadCount: () => get().activities.filter((a) => !a.isRead).length,
}))

export type { Activity }
