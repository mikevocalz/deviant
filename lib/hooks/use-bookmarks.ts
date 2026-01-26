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

// Toggle bookmark mutation
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
    onMutate: async ({ postId, isBookmarked }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.all });

      // Snapshot previous data
      const previousBookmarks = queryClient.getQueryData<string[]>(
        bookmarkKeys.list(),
      );

      // Optimistically update bookmarks list
      queryClient.setQueryData<string[]>(bookmarkKeys.list(), (old = []) => {
        if (isBookmarked) {
          return old.filter((id) => id !== postId);
        } else {
          return [...old, postId];
        }
      });

      return { previousBookmarks };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(
          bookmarkKeys.list(),
          context.previousBookmarks,
        );
      }
      showToast("error", "Error", "Failed to update bookmark");
    },
    onSuccess: (data) => {
      showToast(
        "success",
        data.bookmarked ? "Bookmarked" : "Unbookmarked",
        data.bookmarked
          ? "Post saved to your bookmarks"
          : "Post removed from bookmarks",
      );
      // Invalidate to sync with server
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
  });
}
