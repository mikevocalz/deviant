import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/utils/storage";

interface FeedSlideState {
  currentSlides: Record<string, number>;
  setCurrentSlide: (postId: string, slide: number) => void;
}

export const useFeedSlideStore = create<FeedSlideState>((set) => ({
  currentSlides: {},
  setCurrentSlide: (postId, slide) =>
    set((state) => ({
      currentSlides: { ...state.currentSlides, [postId]: slide },
    })),
}));

interface PostState {
  likedPosts: string[];
  postLikeCounts: Record<string, number>;
  postCommentCounts: Record<string, number>;
  likedComments: string[];
  commentLikeCounts: Record<string, number>;
  toggleLike: (postId: string, initialCount: number) => void;
  getLikeCount: (postId: string, initialCount: number) => number;
  isPostLiked: (postId: string) => boolean;
  syncLikedPosts: (serverLikedPosts: string[]) => void;
  incrementCommentCount: (postId: string, initialCount: number) => void;
  getCommentCount: (postId: string, initialCount: number) => number;
  toggleCommentLike: (commentId: string, initialCount: number) => void;
  getCommentLikeCount: (commentId: string, initialCount: number) => number;
  isCommentLiked: (commentId: string) => boolean;
}

export const usePostStore = create<PostState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      postLikeCounts: {},
      postCommentCounts: {},
      likedComments: [],
      commentLikeCounts: {},

      toggleLike: (postId, initialCount) => {
        const { likedPosts, postLikeCounts } = get();
        const isCurrentlyLiked = likedPosts.includes(postId);

        const newLikedPosts = isCurrentlyLiked
          ? likedPosts.filter((id) => id !== postId)
          : [...likedPosts, postId];

        const currentCount = postLikeCounts[postId] ?? initialCount;
        const newCount = isCurrentlyLiked ? currentCount - 1 : currentCount + 1;

        set({
          likedPosts: newLikedPosts,
          postLikeCounts: { ...postLikeCounts, [postId]: newCount },
        });
      },

      getLikeCount: (postId, initialCount) => {
        return get().postLikeCounts[postId] ?? initialCount;
      },

      isPostLiked: (postId) => get().likedPosts.includes(postId),

      // Sync liked posts from server - replaces local state with server truth
      syncLikedPosts: (serverLikedPosts) => {
        set({ likedPosts: serverLikedPosts });
      },

      incrementCommentCount: (postId, initialCount) => {
        const { postCommentCounts } = get();
        const currentCount = postCommentCounts[postId] ?? initialCount;
        set({
          postCommentCounts: {
            ...postCommentCounts,
            [postId]: currentCount + 1,
          },
        });
      },

      getCommentCount: (postId, initialCount) => {
        return get().postCommentCounts[postId] ?? initialCount;
      },

      toggleCommentLike: (commentId, initialCount) => {
        const { likedComments, commentLikeCounts } = get();
        const isCurrentlyLiked = likedComments.includes(commentId);

        const newLikedComments = isCurrentlyLiked
          ? likedComments.filter((id) => id !== commentId)
          : [...likedComments, commentId];

        const currentCount = commentLikeCounts[commentId] ?? initialCount;
        const newCount = isCurrentlyLiked ? currentCount - 1 : currentCount + 1;

        set({
          likedComments: newLikedComments,
          commentLikeCounts: { ...commentLikeCounts, [commentId]: newCount },
        });
      },

      getCommentLikeCount: (commentId, initialCount) => {
        return get().commentLikeCounts[commentId] ?? initialCount;
      },

      isCommentLiked: (commentId) => get().likedComments.includes(commentId),
    }),
    {
      name: "post-storage",
      storage: createJSONStorage(() => storage),
    },
  ),
);
