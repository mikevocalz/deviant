/**
 * Bookmarks API - manages post bookmarks
 *
 * Uses central apiFetch from api-client for consistent auth handling
 */

import { users, bookmarks } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

export const bookmarksApi = {
  // Bookmark or unbookmark a post - uses central api-client for auth
  async toggleBookmark(
    postId: string,
    isBookmarked: boolean,
  ): Promise<{ postId: string; bookmarked: boolean }> {
    try {
      // CRITICAL: Check if user is authenticated before making request
      const user = useAuthStore.getState().user;
      if (!user) {
        throw new Error("You must be logged in to bookmark posts");
      }

      // Use central api-client's bookmark/unbookmark for consistent auth
      const response = isBookmarked
        ? await bookmarks.unbookmark(postId)
        : await bookmarks.bookmark(postId);

      return {
        postId,
        bookmarked: response.bookmarked,
      };
    } catch (error: any) {
      console.error(
        "[bookmarksApi] toggleBookmark error:",
        error?.message || error,
      );
      // Re-throw with cleaner error message
      if (error?.status === 401 || error?.message?.includes("Unauthorized")) {
        throw new Error("Please log in to bookmark posts");
      }
      throw error;
    }
  },

  // Get all bookmarked post IDs for current user
  async getBookmarkedPosts(): Promise<string[]> {
    try {
      return await users.getBookmarks();
    } catch (error) {
      console.error("[bookmarksApi] getBookmarkedPosts error:", error);
      return [];
    }
  },
};
