/**
 * Cache Patch Utilities
 *
 * Helpers that surgically update TanStack Query caches in-place
 * instead of broad invalidation storms.
 *
 * Rules:
 * - Always patch the specific entity, never refetch the whole list
 * - Works with both flat arrays and infinite query page structures
 * - Returns true if cache was found and patched
 */

import type { QueryClient } from "@tanstack/react-query";
import type { Post } from "@/lib/types";

/**
 * Patch a single entity inside an infinite query's pages.
 * Searches all pages for an item matching entityId, applies patchFn.
 */
export function patchEntityInInfiniteList<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  entityId: string,
  patchFn: (entity: T) => T,
): boolean {
  let found = false;
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        data: (page.data || []).map((item: T) => {
          if (String(item.id) === entityId) {
            found = true;
            return patchFn(item);
          }
          return item;
        }),
      })),
    };
  });
  return found;
}

/**
 * Patch a single entity inside a flat array query cache.
 */
export function patchEntityInList<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  entityId: string,
  patchFn: (entity: T) => T,
): boolean {
  let found = false;
  queryClient.setQueryData<T[]>(queryKey, (old) => {
    if (!old) return old;
    return old.map((item) => {
      if (String(item.id) === entityId) {
        found = true;
        return patchFn(item);
      }
      return item;
    });
  });
  return found;
}

/**
 * Update post like state everywhere it appears in cache.
 * Patches: feed infinite, feed legacy, post detail, profile posts.
 */
export function updatePostLikeEverywhere(
  queryClient: QueryClient,
  postId: string,
  liked: boolean,
  likesCount: number,
): void {
  const patch = (post: Post): Post => ({
    ...post,
    likes: likesCount,
    viewerHasLiked: liked,
  });

  // Infinite feed
  patchEntityInInfiniteList<Post>(
    queryClient,
    ["posts", "feed", "infinite"],
    postId,
    patch,
  );

  // Legacy feed
  patchEntityInList<Post>(queryClient, ["posts", "feed"], postId, patch);

  // Post detail
  queryClient.setQueryData<Post>(["posts", "detail", postId], (old) =>
    old ? patch(old) : old,
  );

  // Profile posts (all users)
  queryClient.setQueriesData<Post[]>({ queryKey: ["profilePosts"] }, (old) => {
    if (!old) return old;
    return old.map((p) => (p.id === postId ? patch(p) : p));
  });
}

/**
 * Update follow relationship everywhere it appears in cache.
 * Patches: profile cache, activity follow state, followers/following lists.
 */
export function updateUserRelationshipEverywhere(
  queryClient: QueryClient,
  targetUserId: string,
  nextRelationship: { isFollowing: boolean; followersCount?: number },
): void {
  // Patch profile-by-username caches
  queryClient.setQueriesData({ queryKey: ["profile"] }, (old: any) => {
    if (!old || typeof old !== "object") return old;
    if (String(old.id) === targetUserId) {
      return {
        ...old,
        isFollowing: nextRelationship.isFollowing,
        followersCount:
          nextRelationship.followersCount ?? old.followersCount,
      };
    }
    return old;
  });

  // Patch user-by-username caches
  queryClient.setQueriesData({ queryKey: ["user"] }, (old: any) => {
    if (!old || typeof old !== "object") return old;
    if (String(old.id) === targetUserId) {
      return {
        ...old,
        isFollowing: nextRelationship.isFollowing,
        followersCount:
          nextRelationship.followersCount ?? old.followersCount,
      };
    }
    return old;
  });
}

/**
 * Update comment like state everywhere.
 */
export function updateCommentLikeEverywhere(
  queryClient: QueryClient,
  commentId: string,
  likesCount: number,
  viewerHasLiked: boolean,
): void {
  // Patch all comment thread caches
  queryClient.setQueriesData({ queryKey: ["comments"] }, (old: any) => {
    if (!old || !Array.isArray(old)) return old;
    return old.map((c: any) =>
      String(c.id) === commentId
        ? { ...c, likesCount, viewerHasLiked }
        : c,
    );
  });
}

/**
 * Update event access state (RSVP, ticket, like) everywhere.
 */
export function updateEventAccessEverywhere(
  queryClient: QueryClient,
  eventId: string,
  accessState: {
    isLiked?: boolean;
    likes?: number;
    isRsvped?: boolean;
    hasTicket?: boolean;
  },
): void {
  const patchEvent = (ev: any): any => {
    if (String(ev.id) !== eventId) return ev;
    return {
      ...ev,
      ...(accessState.isLiked !== undefined && {
        isLiked: accessState.isLiked,
      }),
      ...(accessState.likes !== undefined && { likes: accessState.likes }),
      ...(accessState.isRsvped !== undefined && {
        isRsvped: accessState.isRsvped,
      }),
      ...(accessState.hasTicket !== undefined && {
        hasTicket: accessState.hasTicket,
      }),
    };
  };

  // Patch all event list caches
  queryClient.setQueriesData<any[]>({ queryKey: ["events"] }, (old) => {
    if (!old || !Array.isArray(old)) return old;
    return old.map(patchEvent);
  });

  // Patch event detail
  queryClient.setQueryData(["events", "detail", eventId], (old: any) =>
    old ? patchEvent(old) : old,
  );
}
