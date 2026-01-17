/**
 * React Query hooks for comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApiClient, type Comment } from "@/lib/api/comments";

// Query keys
export const commentKeys = {
  all: ["comments"] as const,
  byPost: (postId: string) => [...commentKeys.all, postId] as const,
};

// Fetch comments for a post
export function useComments(postId: string) {
  return useQuery({
    queryKey: commentKeys.byPost(postId),
    queryFn: () => commentsApiClient.getComments(postId),
    enabled: !!postId,
  });
}

// Create comment mutation
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commentsApiClient.createComment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.byPost(variables.post),
      });
    },
  });
}

export type { Comment };
