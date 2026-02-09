/**
 * usePostLikers — TanStack Query hook for fetching users who liked a post.
 *
 * Query Key: ['postLikers', postId]
 * Only fetches when enabled (sheet is open).
 */

import { useQuery } from "@tanstack/react-query";
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
