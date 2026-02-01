/**
 * Bookmarks API - manages post bookmarks
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";

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
    headers["Authorization"] = `JWT ${authToken}`;
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
  // Bookmark or unbookmark a post
  async toggleBookmark(
    postId: string,
    isBookmarked: boolean,
  ): Promise<{ postId: string; bookmarked: boolean }> {
    try {
      const action = isBookmarked ? "unbookmark" : "bookmark";
      const response = await bookmarkFetch<{
        message: string;
        bookmarked: boolean;
      }>(`/api/posts/${postId}/bookmark`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });

      return {
        postId,
        bookmarked: response.bookmarked,
      };
    } catch (error) {
      console.error("[bookmarksApi] toggleBookmark error:", error);
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
