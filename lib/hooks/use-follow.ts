/**
 * Follow/Unfollow Hook with Optimistic Updates
 *
 * Features:
 * - Instant UI updates (optimistic)
 * - Automatic rollback on error
 * - Cache invalidation for sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { users } from "@/lib/api-client";
import { useUIStore } from "@/lib/stores/ui-store";

interface FollowContext {
  previousUserData: any;
  username: string | null;
}

export function useFollow() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  return useMutation({
    mutationFn: async ({
      userId,
      action,
      username,
    }: {
      userId: string;
      action: "follow" | "unfollow";
      username?: string;
    }) => {
      return await users.follow(userId, action);
    },
    // Optimistic update - instant UI feedback
    onMutate: async ({ userId, action, username }) => {
      // CRITICAL: Only cancel specific user queries, NOT broad ["users"]
      // Canceling ["users"] would affect ALL user caches causing regressions
      const userQueryKey = username
        ? ["users", "username", username]
        : ["users", "id", userId];
      await queryClient.cancelQueries({ queryKey: userQueryKey });

      // Also cancel profile queries for this user
      if (userId) {
        await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      }

      const queryKey = userQueryKey;

      // Snapshot previous value
      const previousUserData = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      if (previousUserData) {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          const isFollowing = action === "follow";
          const countDelta = isFollowing ? 1 : -1;
          return {
            ...old,
            isFollowing,
            followersCount: Math.max(0, (old.followersCount || 0) + countDelta),
          };
        });
      }

      return { previousUserData, username } as FollowContext;
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousUserData && context?.username) {
        queryClient.setQueryData(
          ["users", "username", context.username],
          context.previousUserData,
        );
      }
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        "Failed to update follow status";
      showToast("error", "Error", errorMessage);
    },
    onSuccess: (data, variables) => {
      // Show success toast
      showToast(
        "success",
        data.following ? "Following" : "Unfollowed",
        data.message,
      );
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate only the specific user's profile cache
      // CRITICAL: DO NOT use broad keys like ["users"] as this affects ALL user caches
      if (variables.username) {
        queryClient.invalidateQueries({
          queryKey: ["profile", "username", variables.username],
        });
      }
      if (variables.userId) {
        queryClient.invalidateQueries({
          queryKey: ["profile", variables.userId],
        });
      }
      // Also invalidate follower/following counts for auth user
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
  });
}
