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

// Query keys
export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  list: () => [...bookmarkKeys.all, "list"] as const,
};

// Fetch bookmarked posts and sync to store
export function useBookmarks() {
  return useQuery({
    queryKey: bookmarkKeys.list(),
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

      // Update React Query cache with server state
      queryClient.setQueryData<string[]>(bookmarkKeys.list(), (old = []) => {
        if (data.bookmarked) {
          // Add to list if not present
          return old.includes(postId) ? old : [...old, postId];
        } else {
          // Remove from list
          return old.filter((id) => id !== postId);
        }
      });

      showToast(
        "success",
        data.bookmarked ? "Bookmarked" : "Unbookmarked",
        data.bookmarked
          ? "Post saved to your bookmarks"
          : "Post removed from bookmarks",
      );

      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
    },
  });
}
