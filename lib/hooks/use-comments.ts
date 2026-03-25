/**
 * React Query hooks for comments
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { commentsApi as commentsApiClient } from "@/lib/api/comments";
import type { Comment } from "@/lib/types";
import { postKeys } from "@/lib/hooks/use-posts";
import { usePostStore } from "@/lib/stores/post-store";
import { Image } from "expo-image";
import { STALE_TIMES, GC_TIMES } from "@/lib/perf/stale-time-config";

// Query keys
export const commentKeys = {
  all: ["comments"] as const,
  byPost: (postId: string) => [...commentKeys.all, "post", postId] as const,
  byParent: (parentId: string) =>
    [...commentKeys.all, "parent", parentId] as const,
};

function countCommentsTree(comments: Comment[] = []): number {
  return comments.reduce(
    (total, comment) => total + 1 + countCommentsTree(comment.replies || []),
    0,
  );
}

function findCommentMeta(
  comments: Comment[],
  targetId: string,
  inheritedRootId: string | null = null,
): { depth: number; rootId: string | null } | null {
  for (const comment of comments) {
    const currentRootId = inheritedRootId ?? comment.rootId ?? comment.id;
    if (comment.id === targetId) {
      return {
        depth: typeof comment.depth === "number" ? comment.depth : 0,
        rootId: currentRootId,
      };
    }
    const nested = findCommentMeta(
      comment.replies || [],
      targetId,
      currentRootId,
    );
    if (nested) return nested;
  }
  return null;
}

function findCommentById(
  comments: Comment[],
  targetId: string,
): Comment | undefined {
  for (const comment of comments) {
    if (comment.id === targetId) return comment;
    const nested = findCommentById(comment.replies || [], targetId);
    if (nested) return nested;
  }
  return undefined;
}

function insertCommentIntoTree(
  comments: Comment[],
  parentId: string | undefined,
  optimisticComment: Comment,
): Comment[] {
  if (!parentId) {
    return [optimisticComment, ...comments];
  }

  return comments.map((comment) => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...(comment.replies || []), optimisticComment],
      };
    }

    if (comment.replies?.length) {
      return {
        ...comment,
        replies: insertCommentIntoTree(
          comment.replies,
          parentId,
          optimisticComment,
        ),
      };
    }

    return comment;
  });
}

// Fetch comments for a post
export function useComments(postId: string, limit?: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...commentKeys.byPost(postId), limit || "all"],
    staleTime: STALE_TIMES.comments,
    gcTime: GC_TIMES.short,
    // Show any cached comments for this post instantly (e.g. feed's 3-comment preview)
    // while the full fetch loads in the background — eliminates loading spinner
    placeholderData: (): any => {
      if (!postId) return undefined;
      const candidates = [50, 3, "all"] as const;
      for (const l of candidates) {
        if (l === (limit || "all")) continue;
        const cached = queryClient.getQueryData([
          ...commentKeys.byPost(postId),
          l,
        ]);
        if (Array.isArray(cached) && cached.length > 0) return cached;
      }
      return undefined;
    },
    queryFn: async () => {
      try {
        const comments = await commentsApiClient.getComments(postId, limit);
        // Update comment count in store when comments are fetched
        // For limited fetches, only update if we got the full count (limit reached)
        // For unlimited fetches, always update
        const { postCommentCounts } = usePostStore.getState();
        const currentCount = postCommentCounts[postId];

        if (!limit || limit >= 50) {
          // Full fetch - update count
          const totalComments = countCommentsTree(comments);
          if (currentCount === undefined || totalComments !== currentCount) {
            usePostStore.setState({
              postCommentCounts: {
                ...postCommentCounts,
                [postId]: totalComments,
              },
            });
          }
        } else if (
          limit &&
          comments.length >= limit &&
          currentCount === undefined
        ) {
          // Limited fetch reached limit - set minimum count
          usePostStore.setState({
            postCommentCounts: {
              ...postCommentCounts,
              [postId]: limit,
            },
          });
        }
        // Prefetch avatar images so they appear instantly when comments render
        const avatarUrls = comments
          .map((c) => c.avatar)
          .filter((url): url is string => !!url && url.startsWith("http"));
        if (avatarUrls.length > 0) {
          Image.prefetch(avatarUrls).catch(() => {});
        }

        return comments;
      } catch (error) {
        console.error("[useComments] Error fetching comments:", error);
        return []; // Return empty array on error to prevent crash
      }
    },
    enabled: !!postId,
  });
}

/** Prefetch comments for a post before navigating — eliminates loading state. */
export function prefetchComments(
  queryClient: QueryClient,
  postId: string,
  limit: number = 50,
): void {
  if (!postId) return;
  queryClient.prefetchQuery({
    queryKey: [...commentKeys.byPost(postId), limit || "all"],
    queryFn: () => commentsApiClient.getComments(postId, limit),
    staleTime: STALE_TIMES.comments,
  });
}

/** Hook that returns prefetch fn for use in Pressable onPress. */
export function usePrefetchComments() {
  const queryClient = useQueryClient();
  return useCallback(
    (postId: string) => prefetchComments(queryClient, postId),
    [queryClient],
  );
}

// Create comment mutation with optimistic updates
export function useCreateComment() {
  const queryClient = useQueryClient();

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
      const previousReplyQueries = newComment.parent
        ? queryClient.getQueriesData({
            queryKey: commentKeys.byParent(newComment.parent),
          })
        : [];

      // Get current comment count for rollback
      const store = usePostStore.getState();
      const previousCount = store.getCommentCount(newComment.post, 0);

      // Optimistically increment comment count
      store.setCommentCount(newComment.post, previousCount + 1);

      // Optimistically add the new comment
      const parentMeta = newComment.parent
        ? previousQueries.reduce<{
            depth: number;
            rootId: string | null;
          } | null>(
            (found, [, data]) =>
              found ||
              (Array.isArray(data)
                ? findCommentMeta(data, newComment.parent as string)
                : null),
            null,
          )
        : null;
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        username: newComment.authorUsername || "You",
        avatar: "",
        text: newComment.text,
        timeAgo: "Just now",
        likes: 0,
        postId: newComment.post,
        parentId: newComment.parent || null,
        rootId: parentMeta?.rootId || null,
        depth: newComment.parent ? (parentMeta?.depth || 0) + 1 : 0,
        replies: [],
      };

      // Update ALL comment queries for this post (including limited queries like limit: 3)
      queryClient.setQueriesData<Comment[]>(
        { queryKey: commentKeys.byPost(newComment.post) },
        (old) => {
          if (!old) return [optimisticComment];
          return insertCommentIntoTree(
            old,
            newComment.parent,
            optimisticComment,
          );
        },
      );

      if (newComment.parent) {
        queryClient.setQueriesData<Comment[]>(
          { queryKey: commentKeys.byParent(newComment.parent) },
          (old) => [...(old || []), optimisticComment],
        );
      }

      return { previousQueries, previousReplyQueries };
    },
    onError: (err, newComment, context) => {
      // Roll back on error - restore all previous query states
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousReplyQueries) {
        context.previousReplyQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback comment count increment
      const store = usePostStore.getState();
      const currentCount = store.getCommentCount(newComment.post, 0);
      if (currentCount > 0) {
        store.setCommentCount(newComment.post, currentCount - 1);
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
      if (variables.parent) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.byParent(variables.parent),
          refetchType: "active",
        });
      }
    },
  });
}

// Fetch replies to a comment
export function useReplies(parentId: string, postId: string, limit?: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...commentKeys.byParent(parentId), postId, limit || "all"],
    placeholderData: (): Comment[] | undefined => {
      if (!parentId || !postId) return undefined;
      const candidates = [50, 3, "all"] as const;
      for (const l of candidates) {
        const cached = queryClient.getQueryData<Comment[]>([
          ...commentKeys.byPost(postId),
          l,
        ]);
        if (!Array.isArray(cached) || cached.length === 0) continue;
        const parent = findCommentById(cached, parentId);
        if (parent?.replies?.length) return parent.replies;
      }
      return undefined;
    },
    queryFn: async () => {
      const replies = await commentsApiClient.getReplies(
        parentId,
        postId,
        limit,
      );
      return replies;
    },
    enabled: !!parentId && !!postId,
  });
}

export type { Comment };
