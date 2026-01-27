/**
 * Bookmarks Hook
 *
 * Provides React Query hooks for managing bookmarks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookmarksApi } from "@/lib/api/bookmarks";
import { useUIStore } from "@/lib/stores/ui-store";

// Query keys
export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  list: () => [...bookmarkKeys.all, "list"] as const,
};

// Fetch bookmarked posts
export function useBookmarks() {
  return useQuery({
    queryKey: bookmarkKeys.list(),
    queryFn: () => bookmarksApi.getBookmarkedPosts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * STABILIZED Toggle Bookmark Mutation
 *
 * CRITICAL CHANGES:
 * 1. NO optimistic updates - wait for server confirmation
 * 2. Server response updates React Query cache
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
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
  });
}
