/**
 * Bookmarks Hook
 *
 * STABILIZED: Provides React Query hooks for managing bookmarks
 * - Server is single source of truth
 * - Syncs to Zustand store for offline access
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookmarksApi } from "@/lib/api/bookmarks";
import { useUIStore } from "@/lib/stores/ui-store";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { useAuthStore } from "@/lib/stores/auth-store";

// Query keys - scoped by viewerId for cache isolation
export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  list: (viewerId?: string) =>
    [...bookmarkKeys.all, "list", viewerId || "__no_user__"] as const,
};

// Fetch bookmarked posts and sync to store
export function useBookmarks() {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return useQuery({
    queryKey: bookmarkKeys.list(),
    queryFn: () => bookmarksApi.getBookmarks(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!viewerId,
  });
}

/**
 * INSTANT Bookmark Toggle Mutation with Optimistic Updates
 *
 * FEATURES:
 * - Instant UI feedback (optimistic updates)
 * - Automatic rollback on error
 * - Updates across all screens and profiles immediately
 * - Shows in user profiles instantly
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return useMutation({
    mutationFn: ({
      postId,
      isBookmarked,
    }: {
      postId: string;
      isBookmarked: boolean;
    }) => bookmarksApi.toggleBookmark(postId, isBookmarked),
    // Optimistic update - instant UI feedback
    onMutate: async ({ postId, isBookmarked }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: bookmarkKeys.list(viewerId),
      });

      // Snapshot the previous value
      const previousBookmarks =
        queryClient.getQueryData<string[]>(bookmarkKeys.list(viewerId)) || [];

      // Optimistically update to the new value
      queryClient.setQueryData<string[]>(
        bookmarkKeys.list(viewerId),
        (old = []) => {
          if (!isBookmarked) {
            // Add to bookmarks
            return old.includes(postId) ? old : [...old, postId];
          } else {
            // Remove from bookmarks
            return old.filter((id) => id !== postId);
          }
        },
      );

      // Update Zustand store instantly
      useBookmarkStore.getState().setBookmarked(postId, !isBookmarked);

      return { previousBookmarks, postId, isBookmarked };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousBookmarks && viewerId) {
        queryClient.setQueryData(
          bookmarkKeys.list(viewerId),
          context.previousBookmarks,
        );
      }

      // Rollback Zustand store
      if (context?.postId) {
        useBookmarkStore
          .getState()
          .setBookmarked(context.postId, context.isBookmarked);
      }

      showToast("error", "Error", "Failed to update bookmark");
    },
    onSuccess: (data, variables) => {
      // Ensure final state matches server response
      useBookmarkStore
        .getState()
        .setBookmarked(variables.postId, data.bookmarked);

      showToast(
        "success",
        data.bookmarked ? "Bookmarked" : "Unbookmarked",
        data.bookmarked
          ? "Post saved to your bookmarks"
          : "Post removed from bookmarks",
      );

      // Final sync with server - invalidate to ensure consistency
      if (viewerId) {
        queryClient.invalidateQueries({
          queryKey: bookmarkKeys.list(viewerId),
        });
      }
    },
  });
}
