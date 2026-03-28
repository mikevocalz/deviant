/**
 * React Query hooks for deterministic 2-level comment threads.
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
import {
  countCommentsTree,
  findCommentThread,
  insertCommentIntoThreads,
} from "@/lib/comments/threading";

export type CommentThread = {
  parentComment: Comment;
  replies: Comment[];
};

export const commentKeys = {
  all: ["comments"] as const,
  byPost: (postId: string) => [...commentKeys.all, "post", postId] as const,
  thread: (postId: string, rootCommentId: string) =>
    [...commentKeys.all, "thread", postId, rootCommentId] as const,
};

function findCachedThread(
  queryClient: QueryClient,
  postId: string,
  rootCommentId: string,
): CommentThread | null {
  const cachedThread = queryClient.getQueriesData<CommentThread>({
    queryKey: commentKeys.thread(postId, rootCommentId),
  });

  for (const [, data] of cachedThread) {
    if (data?.parentComment) return data;
  }

  const candidates = [50, 3, "all"] as const;
  for (const limit of candidates) {
    const cached = queryClient.getQueryData<Comment[]>([
      ...commentKeys.byPost(postId),
      limit,
    ]);
    if (!Array.isArray(cached) || cached.length === 0) continue;
    const thread = findCommentThread(cached, rootCommentId);
    if (thread) return thread;
  }

  return null;
}

export function useComments(postId: string, limit?: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...commentKeys.byPost(postId), limit || "all"],
    staleTime: STALE_TIMES.comments,
    gcTime: GC_TIMES.short,
    placeholderData: (): Comment[] | undefined => {
      if (!postId) return undefined;
      const candidates = [50, 3, "all"] as const;
      for (const candidate of candidates) {
        if (candidate === (limit || "all")) continue;
        const cached = queryClient.getQueryData<Comment[]>([
          ...commentKeys.byPost(postId),
          candidate,
        ]);
        if (Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      }
      return undefined;
    },
    queryFn: async () => {
      try {
        const comments = await commentsApiClient.getComments(postId, limit);
        const { postCommentCounts } = usePostStore.getState();
        const currentCount = postCommentCounts[postId];

        if (!limit || limit >= 50) {
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
          usePostStore.setState({
            postCommentCounts: {
              ...postCommentCounts,
              [postId]: limit,
            },
          });
        }

        const avatarUrls = comments
          .flatMap((comment) => [comment.avatar, ...(comment.replies || []).map((reply) => reply.avatar)])
          .filter((url): url is string => !!url && url.startsWith("http"));

        if (avatarUrls.length > 0) {
          Image.prefetch(avatarUrls).catch(() => {});
        }

        return comments;
      } catch (error) {
        console.error("[useComments] Error fetching comments:", error);
        return [];
      }
    },
    enabled: !!postId,
  });
}

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

export function usePrefetchComments() {
  const queryClient = useQueryClient();
  return useCallback(
    (postId: string) => prefetchComments(queryClient, postId),
    [queryClient],
  );
}

export function useCommentThread(
  postId: string,
  rootCommentId: string,
  limit?: number,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...commentKeys.thread(postId, rootCommentId), limit || "all"],
    placeholderData: (): CommentThread | undefined => {
      if (!postId || !rootCommentId) return undefined;
      return findCachedThread(queryClient, postId, rootCommentId) || undefined;
    },
    queryFn: async () => {
      const thread = await commentsApiClient.getCommentThread(
        postId,
        rootCommentId,
        limit,
      );
      return thread;
    },
    enabled: !!postId && !!rootCommentId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commentsApiClient.createComment,
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.byPost(newComment.post),
      });

      if (newComment.parent) {
        await queryClient.cancelQueries({
          queryKey: commentKeys.thread(newComment.post, newComment.parent),
        });
      }

      const previousQueries = queryClient.getQueriesData<Comment[]>({
        queryKey: commentKeys.byPost(newComment.post),
      });
      const previousThreadQueries = newComment.parent
        ? queryClient.getQueriesData<CommentThread>({
            queryKey: commentKeys.thread(newComment.post, newComment.parent),
          })
        : [];

      const store = usePostStore.getState();
      const previousCount = store.getCommentCount(newComment.post, 0);
      store.setCommentCount(newComment.post, previousCount + 1);

      const createdAt = new Date().toISOString();
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        username: newComment.authorUsername || "You",
        avatar: "",
        text: newComment.text,
        timeAgo: "Just now",
        createdAt,
        likes: 0,
        postId: newComment.post,
        parentId: newComment.parent || null,
        rootId: newComment.parent || null,
        depth: newComment.parent ? 1 : 0,
        replies: [],
      };

      queryClient.setQueriesData<Comment[]>(
        { queryKey: commentKeys.byPost(newComment.post) },
        (old) => {
          if (!old) return [optimisticComment];
          return insertCommentIntoThreads(old, optimisticComment);
        },
      );

      if (newComment.parent) {
        const fallbackThread =
          previousThreadQueries.find(([, data]) => !!data?.parentComment)?.[1] ||
          previousQueries.reduce<CommentThread | null>(
            (thread, [, data]) =>
              thread || (Array.isArray(data)
                ? findCommentThread(data, newComment.parent as string)
                : null),
            null,
          );

        queryClient.setQueriesData<CommentThread | null>(
          { queryKey: commentKeys.thread(newComment.post, newComment.parent) },
          (old) => {
            const baseThread = old?.parentComment ? old : fallbackThread;
            if (!baseThread?.parentComment) return old;
            const nextReplies = [...(baseThread.replies || []), optimisticComment];
            return {
              parentComment: {
                ...baseThread.parentComment,
                replies: nextReplies,
              },
              replies: nextReplies,
            };
          },
        );
      }

      return { previousQueries, previousThreadQueries, previousCount };
    },
    onError: (_error, newComment, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousThreadQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      if (typeof context?.previousCount === "number") {
        usePostStore.getState().setCommentCount(newComment.post, context.previousCount);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.byPost(variables.post),
        refetchType: "active",
      });

      if (variables.parent) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.thread(variables.post, variables.parent),
          refetchType: "active",
        });
      }

      queryClient.invalidateQueries({
        queryKey: postKeys.detail(variables.post),
      });
      queryClient.invalidateQueries({
        queryKey: postKeys.all,
      });
    },
  });
}

export function useReplies(parentId: string, postId: string, limit?: number) {
  const thread = useCommentThread(postId, parentId, limit);
  return {
    ...thread,
    data: thread.data?.replies || [],
  };
}

export type { Comment };
