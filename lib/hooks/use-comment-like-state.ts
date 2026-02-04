import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { commentsApi as commentsApiClient } from "@/lib/api/comments";
import type { Comment } from "@/lib/types";
import { commentKeys } from "./use-comments";

export const commentLikeStateKeys = {
  forComment: (viewerId: string, commentId: string) =>
    ["commentLikeState", viewerId, commentId] as const,
};

interface LikeState {
  hasLiked: boolean;
  likesCount: number;
}

interface MutationContext {
  previousState?: LikeState;
  previousComments?: Comment[];
}

function logCacheMutation(action: string, key: readonly unknown[]) {
  if (!__DEV__) return;
  console.log(`[useCommentLikeState] ${action}: ${JSON.stringify(key)}`);
}

function updateCommentLikesTree(
  comments: Comment[] = [],
  targetId: string,
  likes: number,
  hasLiked: boolean,
): Comment[] {
  return comments.map((comment) => {
    if (!comment) return comment;
    let updatedComment: Comment = comment;
    if (comment.id === targetId) {
      updatedComment = { ...comment, likes, hasLiked };
    }
    if (updatedComment.replies && Array.isArray(updatedComment.replies)) {
      return {
        ...updatedComment,
        replies: updateCommentLikesTree(
          updatedComment.replies,
          targetId,
          likes,
          hasLiked,
        ),
      };
    }
    return updatedComment;
  });
}

export function useCommentLikeState(
  postId: string,
  commentId: string,
  initialLikesCount: number = 0,
  initialHasLiked: boolean = false,
) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.user?.id) || "";
  const likeKey = commentLikeStateKeys.forComment(
    viewerId || "__no_user__",
    commentId,
  );

  const existingCache = queryClient.getQueryData<LikeState>(likeKey);

  const { data: likeState } = useQuery<LikeState>({
    queryKey: likeKey,
    queryFn: async () =>
      existingCache || {
        hasLiked: initialHasLiked,
        likesCount: initialLikesCount,
      },
    initialData: existingCache || {
      hasLiked: initialHasLiked,
      likesCount: initialLikesCount,
    },
    enabled: !!viewerId && !!commentId,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationKey: ["commentLike", commentId, viewerId],
    mutationFn: async ({ isLiked }: { isLiked: boolean }) => {
      if (!viewerId) {
        throw new Error("Must be logged in to like comments");
      }
      return commentsApiClient.likeComment(commentId, isLiked);
    },
    onMutate: async ({ isLiked }) => {
      if (!viewerId) return {};

      await queryClient.cancelQueries({ queryKey: likeKey });
      const previousState = queryClient.getQueryData<LikeState>(likeKey);
      const newState: LikeState = {
        hasLiked: !isLiked,
        likesCount: isLiked
          ? Math.max((previousState?.likesCount || 0) - 1, 0)
          : (previousState?.likesCount || initialLikesCount) + 1,
      };

      logCacheMutation("setQueryData", likeKey);
      queryClient.setQueryData(likeKey, newState);

      const previousComments = queryClient.getQueryData<Comment[]>(
        commentKeys.byPost(postId),
      );

      if (previousComments) {
        logCacheMutation("setQueryData", commentKeys.byPost(postId));
        queryClient.setQueryData<Comment[]>(
          commentKeys.byPost(postId),
          updateCommentLikesTree(
            previousComments,
            commentId,
            newState.likesCount,
            newState.hasLiked,
          ),
        );
      }

      return { previousState, previousComments } as MutationContext;
    },
    onError: (_err, _variables, context) => {
      if (!viewerId) return;
      if (context?.previousState) {
        logCacheMutation("setQueryData", likeKey);
        queryClient.setQueryData(likeKey, context.previousState);
      }
      if (context?.previousComments) {
        logCacheMutation("setQueryData", commentKeys.byPost(postId));
        queryClient.setQueryData(
          commentKeys.byPost(postId),
          context.previousComments,
        );
      }
    },
    onSuccess: (data) => {
      if (!viewerId) return;
      const successState: LikeState = {
        hasLiked: data.liked,
        likesCount: data.likes,
      };
      logCacheMutation("setQueryData", likeKey);
      queryClient.setQueryData(likeKey, successState);
      logCacheMutation("setQueryData", commentKeys.byPost(postId));
      const updatedComments = updateCommentLikesTree(
        queryClient.getQueryData(commentKeys.byPost(postId)) || [],
        commentId,
        data.likes,
        data.liked,
      );
      queryClient.setQueryData<Comment[]>(
        commentKeys.byPost(postId),
        updatedComments,
      );

      // Invalidate all related queries for immediate updates across all screens
      const invalidations = [
        // Invalidate the post itself (might show comment count)
        queryClient.invalidateQueries({ queryKey: ["post", postId] }),
        // Invalidate feed (might show comment likes)
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        // Invalidate posts (general cache)
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        // Invalidate any comment-related queries
        queryClient.invalidateQueries({ queryKey: ["comments"] }),
      ];

      // Execute all invalidations in parallel for instant updates
      Promise.all(invalidations).then(() => {
        console.log(
          "[useCommentLikeState] All comment like caches invalidated for instant updates",
        );
      });
    },
  });

  const toggle = useCallback(() => {
    if (!likeState || mutation.isPending || !viewerId) return;
    mutation.mutate({ isLiked: likeState.hasLiked });
  }, [likeState?.hasLiked, mutation, viewerId]);

  const like = useCallback(() => {
    if (mutation.isPending || !viewerId) return;
    mutation.mutate({ isLiked: false });
  }, [mutation, viewerId]);

  const unlike = useCallback(() => {
    if (mutation.isPending || !viewerId) return;
    mutation.mutate({ isLiked: true });
  }, [mutation, viewerId]);

  return {
    hasLiked: likeState?.hasLiked ?? initialHasLiked,
    likesCount: likeState?.likesCount ?? initialLikesCount,
    toggle,
    like,
    unlike,
    isPending: mutation.isPending,
  };
}
