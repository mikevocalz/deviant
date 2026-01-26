/**
 * Follow/Unfollow Hook
 * 
 * Provides React Query mutation for following and unfollowing users
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { users } from "@/lib/api-client";
import { useUIStore } from "@/lib/stores/ui-store";

export function useFollow() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  return useMutation({
    mutationFn: async ({
      userId,
      action,
    }: {
      userId: string;
      action: "follow" | "unfollow";
    }) => {
      return await users.follow(userId, action);
    },
    onMutate: async ({ userId, action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["users"] });

      // Snapshot previous data - get all user-related queries
      const previousUserData = queryClient.getQueriesData({
        queryKey: ["users"],
      });
      const previousMeData = queryClient.getQueryData(["users", "me"]);

      // Optimistically update user data (by userId and by username)
      const isFollowing = action === "follow";
      
      // Update all user queries
      queryClient.setQueriesData(
        { queryKey: ["users"] },
        (old: any) => {
          if (!old) return old;
          // Handle both object and array responses
          if (Array.isArray(old)) {
            return old.map((user: any) => {
              if (user.id === userId || String(user.id) === String(userId)) {
                return {
                  ...user,
                  isFollowing,
                  followersCount: isFollowing
                    ? (user.followersCount || 0) + 1
                    : Math.max(0, (user.followersCount || 0) - 1),
                };
              }
              return user;
            });
          }
          if (old.id === userId || String(old.id) === String(userId)) {
            return {
              ...old,
              isFollowing,
              followersCount: isFollowing
                ? (old.followersCount || 0) + 1
                : Math.max(0, (old.followersCount || 0) - 1),
            };
          }
          return old;
        },
      );
      
      // Also update username-based queries (query key: ["users", "username", username])
      queryClient.setQueriesData(
        { queryKey: ["users", "username"] },
        (old: any) => {
          if (!old) return old;
          if (old.id === userId || String(old.id) === String(userId)) {
            return {
              ...old,
              isFollowing,
              followersCount: isFollowing
                ? (old.followersCount || 0) + 1
                : Math.max(0, (old.followersCount || 0) - 1),
            };
          }
          return old;
        },
      );

      // Optimistically update current user's following count
      queryClient.setQueryData(["users", "me"], (old: any) => {
        if (!old) return old;
        const isFollowing = action === "follow";
        return {
          ...old,
          followingCount: isFollowing
            ? (old.followingCount || 0) + 1
            : Math.max(0, (old.followingCount || 0) - 1),
        };
      });

      return { previousUserData, previousMeData };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousUserData) {
        context.previousUserData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousMeData) {
        queryClient.setQueryData(["users", "me"], context.previousMeData);
      }

      const errorMessage =
        error?.message || error?.error?.message || "Failed to update follow status";
      showToast("error", "Error", errorMessage);
    },
    onSuccess: (data, variables) => {
      showToast(
        "success",
        data.following ? "Following" : "Unfollowed",
        data.message,
      );
      // Invalidate to sync with server - this will refetch user data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
