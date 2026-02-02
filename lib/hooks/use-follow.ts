/**
 * Follow/Unfollow Hook with Optimistic Updates
 *
 * Features:
 * - Instant UI updates (optimistic)
 * - Automatic rollback on error
 * - Cache invalidation for sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { followsApi } from "@/lib/api/supabase-follows";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";

interface FollowContext {
  previousUserData: any;
  username: string | null;
  previousViewerData?: any;
  previousAuthUser?: any;
}

export function useFollow() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const viewerId = authUser?.id;

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
      const isFollowing = action === "unfollow";
      return await followsApi.toggleFollow(userId, isFollowing);
    },
    // Optimistic update - instant UI feedback
    onMutate: async ({ userId, action, username }) => {
      // CRITICAL: Only cancel specific user queries, NOT broad ["users"]
      const userQueryKey = username
        ? ["users", "username", username]
        : ["users", "id", userId];
      await queryClient.cancelQueries({ queryKey: userQueryKey });

      if (userId) {
        await queryClient.cancelQueries({ queryKey: ["profile", userId] });
      }

      const viewerProfileKey = viewerId ? ["profile", viewerId] : null;
      if (viewerProfileKey) {
        await queryClient.cancelQueries({ queryKey: viewerProfileKey });
      }

      const previousUserData = queryClient.getQueryData(userQueryKey);
      const previousViewerData = viewerProfileKey
        ? queryClient.getQueryData(viewerProfileKey)
        : undefined;
      const previousAuthUser = authUser;

      if (previousUserData) {
        queryClient.setQueryData(userQueryKey, (old: any) => {
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

      if (viewerProfileKey && previousViewerData) {
        const delta = action === "follow" ? 1 : -1;
        queryClient.setQueryData(viewerProfileKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            followingCount: Math.max(0, (old.followingCount || 0) + delta),
          };
        });
      }

      if (authUser) {
        const delta = action === "follow" ? 1 : -1;
        setUser({
          ...authUser,
          followingCount: Math.max(0, (authUser.followingCount || 0) + delta),
        });
      }

      return {
        previousUserData,
        username: username || null,
        previousViewerData,
        previousAuthUser,
      } as FollowContext;
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      let targetKey: readonly unknown[] | null = null;
      if (variables.username) {
        targetKey = ["users", "username", variables.username];
      } else if (variables.userId) {
        targetKey = ["users", "id", variables.userId];
      }
      if (context?.previousUserData && targetKey) {
        queryClient.setQueryData(targetKey, context.previousUserData);
      }

      if (viewerId && context?.previousViewerData) {
        queryClient.setQueryData(
          ["profile", viewerId],
          context.previousViewerData,
        );
      }

      if (context?.previousAuthUser) {
        setUser(context.previousAuthUser);
      }

      const errorMessage =
        error?.message ||
        error?.error?.message ||
        "Failed to update follow status";
      showToast("error", "Error", errorMessage);
    },
    onSuccess: (data, variables) => {
      // CRITICAL: Use server response counts to reconcile cache
      console.log("[useFollow] Server response:", {
        following: data.following,
        followersCount: data.followersCount,
        followingCount: data.followingCount,
        targetUserId: variables.userId,
        viewerId,
      });

      // Update target user's profile with server-confirmed follower count
      if (typeof data.followersCount === "number") {
        const targetQueryKey = variables.username
          ? ["users", "username", variables.username]
          : ["users", "id", variables.userId];

        queryClient.setQueryData(targetQueryKey, (old: any) => {
          if (!old) return old;
          return { ...old, followersCount: data.followersCount };
        });

        if (variables.userId) {
          queryClient.setQueryData(
            ["profile", variables.userId],
            (old: any) => {
              if (!old) return old;
              return { ...old, followersCount: data.followersCount };
            },
          );
        }
      }

      // Update viewer's following count with server-confirmed count
      if (typeof data.followingCount === "number" && viewerId) {
        queryClient.setQueryData(["profile", viewerId], (old: any) => {
          if (!old) return old;
          return { ...old, followingCount: data.followingCount };
        });

        if (authUser) {
          setUser({ ...authUser, followingCount: data.followingCount });
        }
      }

      // Show success toast
      showToast(
        "success",
        data.following ? "Following" : "Unfollowed",
        data.message,
      );
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate multiple related caches to ensure instant updates across all profiles
      const invalidations: Promise<unknown>[] = [];

      // Invalidate the target user's profile (by username and ID)
      if (variables.username) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["profile", "username", variables.username],
          }),
          queryClient.invalidateQueries({
            queryKey: ["users", "username", variables.username],
          }),
        );
      }
      if (variables.userId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: ["profile", variables.userId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["users", "id", variables.userId],
          }),
        );
      }

      // Invalidate current user's following/followers data
      if (viewerId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ["authUser"] }),
          queryClient.invalidateQueries({ queryKey: ["profile", viewerId] }),
          queryClient.invalidateQueries({ queryKey: ["following", viewerId] }),
          queryClient.invalidateQueries({ queryKey: ["followers", viewerId] }),
        );
      }

      // Invalidate feed queries that might show follow status
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
      );

      // Execute all invalidations in parallel for instant updates
      Promise.all(invalidations).then(() => {
        console.log(
          "[useFollow] All related caches invalidated for instant updates",
        );
      });
    },
  });
}
