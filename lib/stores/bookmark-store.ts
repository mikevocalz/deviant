import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { storage } from "@/lib/utils/storage"

interface BookmarkState {
  bookmarkedPosts: string[]
  toggleBookmark: (postId: string) => void
  isBookmarked: (postId: string) => boolean
  getBookmarkedPostIds: () => string[]
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarkedPosts: [],
      toggleBookmark: (postId) =>
        set((state) => {
          const isBookmarked = state.bookmarkedPosts.includes(postId)
          const newBookmarks = isBookmarked
            ? state.bookmarkedPosts.filter((id) => id !== postId)
            : [...state.bookmarkedPosts, postId]
          return { bookmarkedPosts: newBookmarks }
        }),
      isBookmarked: (postId) => get().bookmarkedPosts.includes(postId),
      getBookmarkedPostIds: () => get().bookmarkedPosts,
    }),
    {
      name: "bookmark-storage",
      storage: createJSONStorage(() => storage),
    },
  ),
)
