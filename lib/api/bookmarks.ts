import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId } from "./auth-helper";

export const bookmarksApi = {
  /**
   * Get user's bookmarked posts
   */
  async getBookmarks() {
    try {
      console.log("[Bookmarks] getBookmarks");

      const userId = getCurrentUserId();
      if (!userId) return [];

      // bookmarks.user_id uses the user ID
      const { data, error } = await supabase
        .from(DB.bookmarks.table)
        .select(
          `
          ${DB.bookmarks.postId},
          ${DB.bookmarks.createdAt}
        `,
        )
        .eq(DB.bookmarks.userId, userId)
        .order(DB.bookmarks.createdAt, { ascending: false });

      if (error) throw error;

      return (data || []).map((b: any) => String(b[DB.bookmarks.postId]));
    } catch (error) {
      console.error("[Bookmarks] getBookmarks error:", error);
      return [];
    }
  },

  /**
   * Toggle bookmark on post
   */
  async toggleBookmark(postId: string, isBookmarked: boolean) {
    try {
      console.log(
        "[Bookmarks] toggleBookmark:",
        postId,
        "isBookmarked:",
        isBookmarked,
      );

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      if (isBookmarked) {
        // Remove bookmark
        await supabase
          .from(DB.bookmarks.table)
          .delete()
          .eq(DB.bookmarks.userId, userId)
          .eq(DB.bookmarks.postId, parseInt(postId));
      } else {
        // Add bookmark
        await supabase.from(DB.bookmarks.table).insert({
          [DB.bookmarks.userId]: userId,
          [DB.bookmarks.postId]: parseInt(postId),
        });
      }

      return { success: true, bookmarked: !isBookmarked };
    } catch (error) {
      console.error("[Bookmarks] toggleBookmark error:", error);
      throw error;
    }
  },
};
