/**
 * Centralized Post Like State Hook
 *
 * SINGLE SOURCE OF TRUTH for like state across all screens.
 *
 * Query Key: ['likeState', viewerId, postId]
 * Shape: { hasLiked: boolean, likesCount: number }
 *
 * Rules:
 * - UI reads ONLY from this hook
 * - No local useState for liked/likesCount
 * - Optimistic updates with rollback
 * - Button disabled while mutation in-flight
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { likes as likesApi } from "@/lib/api-client";

interface LikeState {
  hasLiked: boolean;
  likesCount: number;
}

// Query keys for like state
export const likeStateKeys = {
  all: ["likeState"] as const,
  forPost: (viewerId: string, postId: string) =>
    ["likeState", viewerId, postId] as const,
};

/**
 * Central hook for post like state
 *
 * @param postId - The post ID
 * @param initialLikesCount - Initial likes count from post data (seed value)
 * @param initialHasLiked - Initial liked state from post data (seed value)
 */
export function usePostLikeState(
  postId: string,
  initialLikesCount: number = 0,
  initialHasLiked: boolean = false,
) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((state) => state.user?.id) || "";

  // Query for like state - seeded with initial values
  const { data: likeState } = useQuery<LikeState>({
    queryKey: likeStateKeys.forPost(viewerId, postId),
    queryFn: async () => {
      // Return the current cached value or initial values
      // The actual sync happens via useSyncLikedPosts
      const cached = queryClient.getQueryData<LikeState>(
        likeStateKeys.forPost(viewerId, postId),
      );
      return (
        cached || { hasLiked: initialHasLiked, likesCount: initialLikesCount }
      );
    },
    initialData: { hasLiked: initialHasLiked, likesCount: initialLikesCount },
    staleTime: Infinity, // Never stale - we manage updates manually
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!viewerId && !!postId,
  });

  // Like mutation with optimistic updates
  const likeMutation = useMutation({
    mutationKey: ["likePost", postId],
    mutationFn: async ({ action }: { action: "like" | "unlike" }) => {
      if (action === "like") {
        return likesApi.likePost(postId);
      } else {
        return likesApi.unlikePost(postId);
      }
    },
    onMutate: async ({ action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: likeStateKeys.forPost(viewerId, postId),
      });

      // Snapshot previous state
      const previousState = queryClient.getQueryData<LikeState>(
        likeStateKeys.forPost(viewerId, postId),
      );

      // Optimistic update
      const newState: LikeState = {
        hasLiked: action === "like",
        likesCount:
          action === "like"
            ? (previousState?.likesCount || 0) + 1
            : Math.max((previousState?.likesCount || 0) - 1, 0),
      };

      queryClient.setQueryData(
        likeStateKeys.forPost(viewerId, postId),
        newState,
      );

      return { previousState };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousState) {
        queryClient.setQueryData(
          likeStateKeys.forPost(viewerId, postId),
          context.previousState,
        );
      }
    },
    onSuccess: (data) => {
      // Sync with server truth
      queryClient.setQueryData<LikeState>(
        likeStateKeys.forPost(viewerId, postId),
        {
          hasLiked: data.liked,
          likesCount: data.likesCount,
        },
      );

      // Also update post detail cache if exists
      // CANONICAL: ['posts', 'detail', postId]
      queryClient.setQueryData(["posts", "detail", postId], (old: any) => {
        if (!old) return old;
        return { ...old, likes: data.likesCount };
      });

      // Update feed caches - CANONICAL: ['posts', 'feed']
      queryClient.setQueryData(["posts", "feed"], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((post: any) =>
            post.id === postId ? { ...post, likes: data.likesCount } : post,
          );
        }
        return old;
      });

      // Update infinite feed cache - CANONICAL: ['posts', 'feed', 'infinite']
      queryClient.setQueryData(["posts", "feed", "infinite"], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((post: any) =>
              post.id === postId ? { ...post, likes: data.likesCount } : post,
            ),
          })),
        };
      });
    },
  });

  // Like action - only if not already liked
  const like = useCallback(() => {
    if (likeState?.hasLiked || likeMutation.isPending) return;
    likeMutation.mutate({ action: "like" });
  }, [likeState?.hasLiked, likeMutation]);

  // Unlike action - only if currently liked
  const unlike = useCallback(() => {
    if (!likeState?.hasLiked || likeMutation.isPending) return;
    likeMutation.mutate({ action: "unlike" });
  }, [likeState?.hasLiked, likeMutation]);

  // Toggle action for convenience
  const toggle = useCallback(() => {
    if (likeMutation.isPending) return;
    if (likeState?.hasLiked) {
      unlike();
    } else {
      like();
    }
  }, [likeState?.hasLiked, likeMutation.isPending, like, unlike]);

  return {
    hasLiked: likeState?.hasLiked ?? initialHasLiked,
    likesCount: likeState?.likesCount ?? initialLikesCount,
    like,
    unlike,
    toggle,
    isPending: likeMutation.isPending,
  };
}

/**
 * Initialize like state for a post from server data
 * Call this when post data is fetched to seed the cache
 */
export function seedLikeState(
  queryClient: ReturnType<typeof useQueryClient>,
  viewerId: string,
  postId: string,
  hasLiked: boolean,
  likesCount: number,
) {
  // Only seed if not already cached
  const existing = queryClient.getQueryData<LikeState>(
    likeStateKeys.forPost(viewerId, postId),
  );

  if (!existing) {
    queryClient.setQueryData<LikeState>(
      likeStateKeys.forPost(viewerId, postId),
      { hasLiked, likesCount },
    );
  }
}
