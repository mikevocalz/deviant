/**
 * Bookmarks API - manages post bookmarks
 *
 * Uses central apiFetch from api-client for consistent auth handling
 */

import { useAuthStore } from "@/lib/stores/auth-store";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";

async function bookmarkFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get auth token and cookies
  const { getAuthToken, getAuthCookies } = await import("@/lib/auth-client");
  const authToken = await getAuthToken();
  const authCookies = getAuthCookies();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (authCookies) {
    headers["Cookie"] = authCookies;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: API_BASE_URL ? "omit" : "include",
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error || errorMessage;
    } catch {
      // Response is not JSON, use status text
      errorMessage = `API error: ${response.status} ${response.statusText || ""}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const bookmarksApi = {
  // Bookmark a post
  async bookmark(postId: string): Promise<{ bookmarked: boolean }> {
    try {
      await bookmarkFetch<any>(`/api/posts/${postId}/bookmark`, {
        method: "POST",
      });
      return { bookmarked: true };
    } catch (error) {
      console.error("[bookmarksApi] bookmark error:", error);
      throw error;
    }
  },

  // Unbookmark a post
  async unbookmark(postId: string): Promise<{ bookmarked: boolean }> {
    try {
      await bookmarkFetch<any>(`/api/posts/${postId}/bookmark`, {
        method: "DELETE",
      });
      return { bookmarked: false };
    } catch (error) {
      console.error("[bookmarksApi] unbookmark error:", error);
      throw error;
    }
  },

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

      // Use this API's bookmark/unbookmark for consistent auth
      const response = isBookmarked
        ? await this.unbookmark(postId)
        : await this.bookmark(postId);

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
      // Use Payload custom endpoint /users/me/bookmarks
      const response = await bookmarkFetch<{
        docs: Array<{ id: string }>;
      }>("/api/users/me/bookmarks?limit=1000");

      return response.docs.map((post) => post.id);
    } catch (error) {
      console.error("[bookmarksApi] getBookmarkedPosts error:", error);
      return [];
    }
  },
};
