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
    queryKey: bookmarkKeys.list(viewerId),
    queryFn: async () => {
      const bookmarks = await bookmarksApi.getBookmarkedPosts();

      // Sync to Zustand store
      useBookmarkStore.getState().syncBookmarks(bookmarks);

      return bookmarks;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * STABILIZED Toggle Bookmark Mutation
 *
 * CRITICAL CHANGES:
 * 1. NO optimistic updates - wait for server confirmation
 * 2. Server response updates React Query cache AND Zustand store
 * 3. Invalidate queries to refresh from server
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
    // NO onMutate - no optimistic updates
    onError: (_err) => {
      showToast("error", "Error", "Failed to update bookmark");
    },
    onSuccess: (data, variables) => {
      const { postId } = variables;

      // Update Zustand store with server state
      useBookmarkStore.getState().setBookmarked(postId, data.bookmarked);

      // Update React Query cache with server state - use scoped key
      queryClient.setQueryData<string[]>(
        bookmarkKeys.list(viewerId),
        (old = []) => {
          if (data.bookmarked) {
            // Add to list if not present
            return old.includes(postId) ? old : [...old, postId];
          } else {
            // Remove from list
            return old.filter((id) => id !== postId);
          }
        },
      );

      showToast(
        "success",
        data.bookmarked ? "Bookmarked" : "Unbookmarked",
        data.bookmarked
          ? "Post saved to your bookmarks"
          : "Post removed from bookmarks",
      );

      // Invalidate to ensure sync with server - use scoped key
      if (viewerId) {
        queryClient.invalidateQueries({
          queryKey: bookmarkKeys.list(viewerId),
        });
      }
    },
  });
}
