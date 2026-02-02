/**
 * React Query hooks for comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApi as commentsApiClient } from "@/lib/api/supabase-comments";
import type { Comment } from "@/lib/types";
import { postKeys } from "@/lib/hooks/use-posts";
import { usePostStore } from "@/lib/stores/post-store";

// Query keys
export const commentKeys = {
  all: ["comments"] as const,
  byPost: (postId: string) => [...commentKeys.all, "post", postId] as const,
  byParent: (parentId: string) => [...commentKeys.all, "parent", parentId] as const,
};

// Fetch comments for a post
export function useComments(postId: string, limit?: number) {
  return useQuery({
    queryKey: [...commentKeys.byPost(postId), limit || "all"],
    queryFn: async () => {
      const comments = await commentsApiClient.getComments(postId, limit);
      // Update comment count in store when comments are fetched
      // For limited fetches, only update if we got the full count (limit reached)
      // For unlimited fetches, always update
      const { postCommentCounts } = usePostStore.getState();
      const currentCount = postCommentCounts[postId];
      
      if (!limit || limit >= 50) {
        // Full fetch - update count
        if (currentCount === undefined || comments.length !== currentCount) {
          usePostStore.setState({
            postCommentCounts: {
              ...postCommentCounts,
              [postId]: comments.length,
            },
          });
        }
      } else if (limit && comments.length >= limit && currentCount === undefined) {
        // Limited fetch reached limit - set minimum count
        usePostStore.setState({
          postCommentCounts: {
            ...postCommentCounts,
            [postId]: limit,
          },
        });
      }
      return comments;
    },
    enabled: !!postId,
  });
}

// Create comment mutation with optimistic updates
export function useCreateComment() {
  const queryClient = useQueryClient();
  const { incrementCommentCount, getCommentCount } = usePostStore.getState();

  return useMutation({
    mutationFn: commentsApiClient.createComment,
    // Optimistic update: show comment immediately
    onMutate: async (newComment) => {
      // Cancel any outgoing refetches (including limited queries)
      await queryClient.cancelQueries({
        queryKey: commentKeys.byPost(newComment.post),
      });

      // Snapshot the previous value for all comment queries (including limited ones)
      const previousQueries = queryClient.getQueriesData({
        queryKey: commentKeys.byPost(newComment.post),
      });

      // Optimistically increment comment count in store
      const currentCount = getCommentCount(newComment.post, 0);
      incrementCommentCount(newComment.post, currentCount);
      
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

      // Update ALL comment queries for this post (including limited queries like limit: 3)
      queryClient.setQueriesData<Comment[]>(
        { queryKey: commentKeys.byPost(newComment.post) },
        (old) => {
          if (!old) return [optimisticComment];
          // For limited queries, add to the beginning and keep only the limit
          // For unlimited queries, just add to the end
          const isLimitedQuery = Array.isArray(old) && old.length > 0;
          if (isLimitedQuery) {
            // Add new comment at the beginning (newest first)
            const updated = [optimisticComment, ...old];
            // If this is a limited query (like limit: 3), keep only the first N comments
            // We can't know the exact limit, so we'll keep the same length + 1
            // The real refetch will correct this
            return updated;
          }
          return [...old, optimisticComment];
        },
      );

      return { previousQueries };
    },
    onError: (err, newComment, context) => {
      // Roll back on error - restore all previous query states
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback comment count increment
      const { postCommentCounts } = usePostStore.getState();
      const currentCount = postCommentCounts[newComment.post];
      if (currentCount !== undefined && currentCount > 0) {
        usePostStore.setState({
          postCommentCounts: {
            ...postCommentCounts,
            [newComment.post]: currentCount - 1,
          },
        });
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after mutation settles to get real data
      // This invalidates ALL comment queries for this post (including limited ones)
      queryClient.invalidateQueries({
        queryKey: commentKeys.byPost(variables.post),
        refetchType: "active", // Only refetch active queries (ones currently being used)
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

// Like/unlike comment mutation
export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, isLiked }: { commentId: string; isLiked: boolean }) =>
      commentsApiClient.likeComment(commentId, isLiked),
    onMutate: async ({ commentId, isLiked }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: commentKeys.all });

      // Snapshot previous data
      const previousData = queryClient.getQueriesData({
        queryKey: commentKeys.all,
      });

      // Also update Zustand store optimistically for instant UI updates
      const { usePostStore } = await import("@/lib/stores/post-store");
      const store = usePostStore.getState();
      const currentCount = store.getCommentLikeCount(commentId, 0);
      const delta = isLiked ? -1 : 1;
      usePostStore.setState({
        commentLikeCounts: {
          ...store.commentLikeCounts,
          [commentId]: Math.max(0, currentCount + delta),
        },
        likedComments: isLiked
          ? store.likedComments.filter((id) => id !== commentId)
          : [...store.likedComments, commentId],
      });

      // Optimistically update comment likes in all comment caches
      queryClient.setQueriesData<Comment[]>(
        { queryKey: commentKeys.all },
        (old) => {
          if (!old) return old;
          const delta = isLiked ? -1 : 1;
          return old.map((comment) => {
            if (comment.id === commentId) {
              return { ...comment, likes: Math.max(0, comment.likes + delta) };
            }
            // Also check replies
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: comment.replies.map((reply) =>
                  reply.id === commentId
                    ? { ...reply, likes: Math.max(0, reply.likes + delta) }
                    : reply,
                ),
              };
            }
            return comment;
          });
        },
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Invalidate user data to sync liked comments
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
  });
}

// Fetch replies to a comment
export function useReplies(parentId: string, limit?: number) {
  return useQuery({
    queryKey: [...commentKeys.byParent(parentId), limit || "all"],
    queryFn: async () => {
      const replies = await commentsApiClient.getReplies(parentId, limit);
      return replies;
    },
    enabled: !!parentId,
  });
}

export type { Comment };
