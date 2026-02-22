/**
 * usePostLikers — TanStack Query hook for fetching users who liked a post.
 *
 * Query Key: ['postLikers', postId]
 * Only fetches when enabled (sheet is open).
 *
 * Prefetch: Call prefetchPostLikers before opening LikesSheet to avoid waterfall.
 */

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { likesApi, type PostLiker } from "@/lib/api/likes";

export const postLikersKeys = {
  all: ["postLikers"] as const,
  forPost: (postId: string) => ["postLikers", postId] as const,
};

export function usePostLikers(postId: string | undefined, enabled: boolean) {
  return useQuery<PostLiker[]>({
    queryKey: postLikersKeys.forPost(postId || ""),
    queryFn: () => likesApi.getPostLikers(postId!),
    enabled: !!postId && enabled,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Prefetch likers before opening sheet — eliminates waterfall. Fire-and-forget. */
export function prefetchPostLikers(
  queryClient: QueryClient,
  postId: string,
): void {
  if (!postId) return;
  queryClient.prefetchQuery({
    queryKey: postLikersKeys.forPost(postId),
    queryFn: () => likesApi.getPostLikers(postId),
  });
}

/** Hook that returns prefetch fn for use in Pressable onPress */
export function usePrefetchPostLikers() {
  const queryClient = useQueryClient();
  return useCallback(
    (postId: string) => prefetchPostLikers(queryClient, postId),
    [queryClient],
  );
}
