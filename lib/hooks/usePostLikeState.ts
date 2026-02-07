/**
 * Centralized Post Like State Hook
 *
 * SINGLE SOURCE OF TRUTH for like state across all screens.
 *
 * Query Key: ['likeState', viewerId, postId]
 * Shape: { hasLiked: boolean, likes: number }
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
import { likesApi } from "@/lib/api/likes";
import { postKeys } from "@/lib/hooks/use-posts";
import type { Post } from "@/lib/types";

interface LikeState {
  hasLiked: boolean;
  likes: number;
}

function logCacheMutation(
  action: "setQueryData" | "invalidateQueries",
  key: readonly unknown[],
) {
  if (!__DEV__) return;
  console.log(`[usePostLikeState] ${action}: ${JSON.stringify(key)}`);
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
  authorId?: string,
) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((state) => state.user?.id) || "";
  const normalizedPostId =
    typeof postId === "string" ? postId : postId != null ? String(postId) : "";
  const likeStateQueryKey = likeStateKeys.forPost(viewerId, normalizedPostId);

  // CRITICAL: Check if we already have cached data BEFORE using initialData
  // This ensures we use server-synced values over stale props on re-mount
  const existingCache = queryClient.getQueryData<LikeState>(likeStateQueryKey);

  // Query for like state - use cached data or seed with initial values
  // NOTE: We use cache-first approach to prevent crashes from missing backend endpoints
  const { data: likeState } = useQuery<LikeState>({
    queryKey: likeStateQueryKey,
    queryFn: async () => {
      // Return cached value or initial values - no server fetch to prevent crashes
      const cached = queryClient.getQueryData<LikeState>(likeStateQueryKey);
      return cached || { hasLiked: initialHasLiked, likes: initialLikesCount };
    },
    // CRITICAL: Use existing cache if available, otherwise use initial props
    initialData: existingCache || {
      hasLiked: initialHasLiked,
      likes: initialLikesCount,
    },
    staleTime: Infinity, // Never stale - we manage updates via mutations
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!viewerId && !!normalizedPostId,
  });

  // Like mutation with optimistic updates
  const likeMutation = useMutation({
    mutationKey: ["likePost", normalizedPostId],
    mutationFn: async ({ action }: { action: "like" | "unlike" }) => {
      if (action === "like") {
        return likesApi.likePost(normalizedPostId);
      } else {
        return likesApi.unlikePost(normalizedPostId);
      }
    },
    onMutate: async ({ action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: likeStateQueryKey,
      });

      // Snapshot previous state
      const previousState =
        queryClient.getQueryData<LikeState>(likeStateQueryKey);

      // Optimistic update on likeState cache
      const newHasLiked = action === "like";
      const newLikes =
        action === "like"
          ? (previousState?.likes || 0) + 1
          : Math.max((previousState?.likes || 0) - 1, 0);
      const newState: LikeState = { hasLiked: newHasLiked, likes: newLikes };

      logCacheMutation("setQueryData", likeStateQueryKey);
      queryClient.setQueryData(likeStateQueryKey, newState);

      // CRITICAL: Also update infinite feed cache so feed props stay in sync
      const prevFeedData = queryClient.getQueryData<any>(
        postKeys.feedInfinite(),
      );
      queryClient.setQueryData(postKeys.feedInfinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((post: any) =>
              String(post.id) === normalizedPostId
                ? {
                    ...post,
                    likes: newLikes,
                    viewerHasLiked: newHasLiked,
                  }
                : post,
            ),
          })),
        };
      });

      // Update post detail cache
      queryClient.setQueryData(
        ["posts", "detail", normalizedPostId],
        (old: any) => {
          if (!old) return old;
          return { ...old, likes: newLikes, viewerHasLiked: newHasLiked };
        },
      );

      return { previousState, prevFeedData };
    },
    onError: (_err, _variables, context) => {
      // Rollback likeState cache
      if (context?.previousState) {
        queryClient.setQueryData(likeStateQueryKey, context.previousState);
      }
      // Rollback feed cache
      if (context?.prevFeedData) {
        queryClient.setQueryData(postKeys.feedInfinite(), context.prevFeedData);
      }
    },
    onSuccess: (data) => {
      // Sync with server truth
      logCacheMutation("setQueryData", likeStateQueryKey);
      queryClient.setQueryData<LikeState>(likeStateQueryKey, {
        hasLiked: data.liked,
        likes: data.likes,
      });

      // CRITICAL: Update ALL like state caches for this post across all viewers
      // This ensures the feed shows correct like count when returning from detail
      queryClient.setQueriesData<LikeState>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === "likeState" &&
              key[2] === normalizedPostId
            );
          },
        },
        { hasLiked: data.liked, likes: data.likes },
      );

      // Also update post detail cache if exists
      // CANONICAL: ['posts', 'detail', postId]
      logCacheMutation("setQueryData", ["posts", "detail", normalizedPostId]);
      queryClient.setQueryData(
        ["posts", "detail", normalizedPostId],
        (old: any) => {
          if (!old) return old;
          return { ...old, likes: data.likes };
        },
      );

      // Update feed caches - CANONICAL: ['posts', 'feed']
      logCacheMutation("setQueryData", ["posts", "feed"]);
      queryClient.setQueryData(["posts", "feed"], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((post: any) =>
            post.id === normalizedPostId
              ? { ...post, likes: data.likes }
              : post,
          );
        }
        return old;
      });

      // Update infinite feed cache - CANONICAL: ['posts', 'feed', 'infinite']
      logCacheMutation("setQueryData", ["posts", "feed", "infinite"]);
      queryClient.setQueryData(["posts", "feed", "infinite"], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((post: any) =>
              post.id === normalizedPostId
                ? { ...post, likes: data.likes }
                : post,
            ),
          })),
        };
      });

      if (authorId) {
        logCacheMutation("setQueryData", postKeys.profilePosts(authorId));
        queryClient.setQueryData(
          postKeys.profilePosts(authorId),
          (old: any) => {
            if (!old || !Array.isArray(old)) return old;
            return old.map((post: any) =>
              post.id === normalizedPostId
                ? { ...post, likes: data.likes }
                : post,
            );
          },
        );
      }

      // Update any saved-posts cache (`usePostsByIds`) that contains this post
      queryClient.setQueriesData<Post[]>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key) || key.length < 3) return false;
            if (key[0] !== "posts" || key[1] !== "byIds") return false;
            const idsArg = key[2];
            if (typeof idsArg !== "string" || !normalizedPostId) return false;
            const ids = idsArg.split(",");
            return ids.includes(normalizedPostId);
          },
        },
        (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((post) =>
            post?.id === normalizedPostId
              ? { ...post, likes: data.likes }
              : post,
          );
        },
      );
    },
  });

  // Like action - only if not already liked
  const like = useCallback(() => {
    if (!normalizedPostId || likeState?.hasLiked || likeMutation.isPending)
      return;
    likeMutation.mutate({ action: "like" });
  }, [likeState?.hasLiked, likeMutation, normalizedPostId]);

  // Unlike action - only if currently liked
  const unlike = useCallback(() => {
    if (!normalizedPostId || !likeState?.hasLiked || likeMutation.isPending)
      return;
    likeMutation.mutate({ action: "unlike" });
  }, [likeState?.hasLiked, likeMutation, normalizedPostId]);

  // Toggle action for convenience
  const toggle = useCallback(() => {
    if (likeMutation.isPending) return;
    if (likeState?.hasLiked) {
      unlike();
    } else {
      like();
    }
  }, [likeState?.hasLiked, likeMutation.isPending, like, unlike]);

  // CRITICAL: Prioritize cached data over initial props
  // This ensures likes sync correctly on back navigation
  const finalHasLiked =
    likeState?.hasLiked ?? existingCache?.hasLiked ?? initialHasLiked;
  const finalLikesCount =
    likeState?.likes ?? existingCache?.likes ?? initialLikesCount;

  return {
    hasLiked: finalHasLiked,
    likes: finalLikesCount,
    like,
    unlike,
    toggle,
    isPending: likeMutation.isPending,
  };
}

/**
 * Initialize like state for a post from server data
 * Call this when post data is fetched to seed the cache
 *
 * CRITICAL: Only seeds if no existing cache entry — never overwrites optimistic updates
 */
export function seedLikeState(
  queryClient: ReturnType<typeof useQueryClient>,
  viewerId: string,
  postId: string,
  hasLiked: boolean,
  likes: number,
) {
  const normalizedPostId =
    typeof postId === "string" ? postId : postId != null ? String(postId) : "";

  if (!normalizedPostId) {
    if (__DEV__) {
      console.warn("[seedLikeState] skipping seed for empty postId", postId);
    }
    return;
  }

  const key = likeStateKeys.forPost(viewerId, normalizedPostId);

  // CRITICAL: Only seed if no existing cache — never overwrite optimistic updates
  const existing = queryClient.getQueryData<LikeState>(key);
  if (existing) {
    return;
  }

  queryClient.setQueryData<LikeState>(key, { hasLiked, likes });

  if (__DEV__) {
    console.log(
      `[seedLikeState] Post ${normalizedPostId}: hasLiked=${hasLiked}, likes=${likes}`,
    );
  }
}
