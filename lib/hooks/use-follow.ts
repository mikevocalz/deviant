/**
 * Follow/Unfollow Hook with Optimistic Updates
 *
 * Features:
 * - Instant UI updates (optimistic)
 * - Automatic rollback on error
 * - Cache invalidation for sync
 */

import {
  useMutation,
  useQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import { followsApi } from "@/lib/api/follows";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useActivityStore } from "@/lib/stores/activity-store";

interface FollowContext {
  previousUserData: any;
  username: string | null;
  previousViewerData?: any;
  previousAuthUser?: any;
  previousListCaches: Array<{ queryKey: readonly unknown[]; data: any }>;
  previousActivityFollowed?: boolean;
}

/**
 * Walk ALL paginated (infinite) and flat list caches that contain user items
 * and flip the isFollowing flag for the target user.
 */
function optimisticUpdateListCaches(
  queryClient: QueryClient,
  targetUserId: string,
  targetUsername: string | undefined,
  newIsFollowing: boolean,
): Array<{ queryKey: readonly unknown[]; data: any }> {
  const snapshots: Array<{ queryKey: readonly unknown[]; data: any }> = [];

  // Match any list cache that might contain user items with isFollowing
  const listPrefixes = ["users", "followers", "following"];

  for (const prefix of listPrefixes) {
    const queries = queryClient.getQueriesData<any>({ queryKey: [prefix] });
    for (const [queryKey, data] of queries) {
      if (!data) continue;
      snapshots.push({ queryKey: [...queryKey], data });

      // Handle infinite query shape: { pages: [{ users: [...] }] }
      if (data.pages && Array.isArray(data.pages)) {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => {
              if (!page?.users || !Array.isArray(page.users)) return page;
              return {
                ...page,
                users: page.users.map((u: any) => {
                  if (
                    String(u.id) === String(targetUserId) ||
                    (targetUsername && u.username === targetUsername)
                  ) {
                    return { ...u, isFollowing: newIsFollowing };
                  }
                  return u;
                }),
              };
            }),
          };
        });
      }
      // Handle flat array shape: [{ id, isFollowing, ... }]
      else if (Array.isArray(data)) {
        queryClient.setQueryData(queryKey, (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map((u: any) => {
            if (
              String(u.id) === String(targetUserId) ||
              (targetUsername && u.username === targetUsername)
            ) {
              return { ...u, isFollowing: newIsFollowing };
            }
            return u;
          });
        });
      }
    }
  }

  return snapshots;
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
    // Optimistic update - instant UI feedback across ALL screens
    onMutate: async ({ userId, action, username }) => {
      const newIsFollowing = action === "follow";
      const countDelta = newIsFollowing ? 1 : -1;

      // Cancel relevant queries to prevent overwrites
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
      // Cancel list caches that will be optimistically updated
      await queryClient.cancelQueries({ queryKey: ["users", "followers"] });
      await queryClient.cancelQueries({ queryKey: ["users", "following"] });

      // Snapshot previous state for rollback
      const previousUserData = queryClient.getQueryData(userQueryKey);
      const previousViewerData = viewerProfileKey
        ? queryClient.getQueryData(viewerProfileKey)
        : undefined;
      const previousAuthUser = authUser;

      // 1. Update target user's profile cache
      if (previousUserData) {
        queryClient.setQueryData(userQueryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            isFollowing: newIsFollowing,
            followersCount: Math.max(0, (old.followersCount || 0) + countDelta),
          };
        });
      }

      // 2. Update viewer's profile cache (following count)
      if (viewerProfileKey && previousViewerData) {
        queryClient.setQueryData(viewerProfileKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            followingCount: Math.max(0, (old.followingCount || 0) + countDelta),
          };
        });
      }

      // 3. Update auth store (following count)
      if (authUser) {
        setUser({
          ...authUser,
          followingCount: Math.max(
            0,
            (authUser.followingCount || 0) + countDelta,
          ),
        });
      }

      // 4. CRITICAL: Update ALL paginated list caches (followers/following lists)
      const previousListCaches = optimisticUpdateListCaches(
        queryClient,
        userId,
        username,
        newIsFollowing,
      );

      // 5. Sync activity store's followedUsers set
      const activityStore = useActivityStore.getState();
      const previousActivityFollowed = username
        ? activityStore.followedUsers.has(username)
        : undefined;
      if (username) {
        const newFollowedUsers = new Set(activityStore.followedUsers);
        if (newIsFollowing) {
          newFollowedUsers.add(username);
        } else {
          newFollowedUsers.delete(username);
        }
        useActivityStore.setState({ followedUsers: newFollowedUsers });
      }

      return {
        previousUserData,
        username: username || null,
        previousViewerData,
        previousAuthUser,
        previousListCaches,
        previousActivityFollowed,
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

      // Rollback list caches
      if (context?.previousListCaches) {
        for (const { queryKey, data } of context.previousListCaches) {
          queryClient.setQueryData(queryKey, data);
        }
      }

      // Rollback activity store
      if (
        variables.username &&
        typeof context?.previousActivityFollowed === "boolean"
      ) {
        const newFollowedUsers = new Set(
          useActivityStore.getState().followedUsers,
        );
        if (context.previousActivityFollowed) {
          newFollowedUsers.add(variables.username);
        } else {
          newFollowedUsers.delete(variables.username);
        }
        useActivityStore.setState({ followedUsers: newFollowedUsers });
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
        data.following
          ? "You are now following this user"
          : "You unfollowed this user",
      );
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate multiple related caches to ensure server-truth sync
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
        );
      }

      // Invalidate ALL followers/following list caches so they refetch with correct isFollowing
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ["users", "followers"] }),
        queryClient.invalidateQueries({ queryKey: ["users", "following"] }),
      );

      // Execute all invalidations in parallel
      Promise.all(invalidations).then(() => {
        console.log("[useFollow] All related caches invalidated for sync");
      });
    },
  });
}
