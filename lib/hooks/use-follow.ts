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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["users"] });

      const queryKey = username
        ? ["users", "username", username]
        : ["users", "id", userId];

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
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
