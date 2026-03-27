import { supabase } from "../supabase/client";
import { requireBetterAuthToken } from "../auth/identity";

interface ToggleBookmarkResponse {
  ok: boolean;
  data?: { bookmarked: boolean };
  error?: { code: string; message: string };
}

export const bookmarksApi = {
  /**
   * Get user's bookmarked posts (Edge Function — bypasses RLS)
   */
  async getBookmarks() {
    try {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<{
        postIds?: string[];
        error?: string;
      }>("get-bookmarks", {
        body: {},
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("[Bookmarks] getBookmarks Edge Function error:", error);
        return [];
      }
      if (!data?.postIds) {
        if (data?.error) console.error("[Bookmarks] get-bookmarks:", data.error);
        return [];
      }
      return data.postIds;
    } catch (error) {
      console.error("[Bookmarks] getBookmarks error:", error);
      return [];
    }
  },

  /**
   * Toggle bookmark on post via Edge Function
   */
  async toggleBookmark(postId: string, _isBookmarked?: boolean) {
    try {
      console.log("[Bookmarks] toggleBookmark via Edge Function:", postId);

      const token = await requireBetterAuthToken();
      const postIdInt = parseInt(postId);

      const { data, error } =
        await supabase.functions.invoke<ToggleBookmarkResponse>(
          "toggle-bookmark",
          {
            body: { postId: postIdInt },
            headers: { Authorization: `Bearer ${token}` },
          },
        );

      if (error) {
        console.error("[Bookmarks] Edge Function error:", error);
        throw new Error(error.message || "Failed to toggle bookmark");
      }

      if (!data?.ok || !data?.data) {
        const errorMessage =
          data?.error?.message || "Failed to toggle bookmark";
        console.error("[Bookmarks] Toggle failed:", errorMessage);
        throw new Error(errorMessage);
      }

      console.log("[Bookmarks] toggleBookmark result:", data.data);
      return { success: true, bookmarked: data.data.bookmarked };
    } catch (error) {
      console.error("[Bookmarks] toggleBookmark error:", error);
      throw error;
    }
  },
};
