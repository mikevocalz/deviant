/**
 * React Query hooks for comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApiClient, type Comment } from "@/lib/api/comments";
import { postKeys } from "@/lib/hooks/use-posts";

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

// Create comment mutation with optimistic updates
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commentsApiClient.createComment,
    // Optimistic update: show comment immediately
    onMutate: async (newComment) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.byPost(newComment.post),
      });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<Comment[]>(
        commentKeys.byPost(newComment.post)
      );

      // Optimistically add the new comment
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        username: newComment.authorUsername || "You",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newComment.authorUsername || "You")}`,
        text: newComment.text,
        timeAgo: "Just now",
        likes: 0,
        replies: [],
      };

      queryClient.setQueryData<Comment[]>(
        commentKeys.byPost(newComment.post),
        (old) => [...(old || []), optimisticComment]
      );

      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // Roll back on error
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.byPost(newComment.post),
          context.previousComments
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after mutation settles to get real data
      queryClient.invalidateQueries({
        queryKey: commentKeys.byPost(variables.post),
      });
      // Also invalidate the post data so comment count updates in feed/post details
      queryClient.invalidateQueries({
        queryKey: postKeys.detail(variables.post),
      });
      queryClient.invalidateQueries({
        queryKey: postKeys.all,
      });
    },
  });
}

export type { Comment };
