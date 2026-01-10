import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { storage } from "@/lib/utils/storage"

interface FeedSlideState {
  currentSlides: Record<string, number>
  setCurrentSlide: (postId: string, slide: number) => void
}

export const useFeedSlideStore = create<FeedSlideState>((set) => ({
  currentSlides: {},
  setCurrentSlide: (postId, slide) => set((state) => ({
    currentSlides: { ...state.currentSlides, [postId]: slide }
  })),
}))

interface PostState {
  likedPosts: string[]
  postLikeCounts: Record<string, number>
  toggleLike: (postId: string, initialCount: number) => void
  getLikeCount: (postId: string, initialCount: number) => number
  isPostLiked: (postId: string) => boolean
}

export const usePostStore = create<PostState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      postLikeCounts: {},

      toggleLike: (postId, initialCount) => {
        const { likedPosts, postLikeCounts } = get()
        const isCurrentlyLiked = likedPosts.includes(postId)

        const newLikedPosts = isCurrentlyLiked ? likedPosts.filter((id) => id !== postId) : [...likedPosts, postId]

        const currentCount = postLikeCounts[postId] ?? initialCount
        const newCount = isCurrentlyLiked ? currentCount - 1 : currentCount + 1

        set({
          likedPosts: newLikedPosts,
          postLikeCounts: { ...postLikeCounts, [postId]: newCount },
        })
      },

      getLikeCount: (postId, initialCount) => {
        return get().postLikeCounts[postId] ?? initialCount
      },

      isPostLiked: (postId) => get().likedPosts.includes(postId),
    }),
    {
      name: "post-storage",
      storage: createJSONStorage(() => storage),
    },
  ),
)
