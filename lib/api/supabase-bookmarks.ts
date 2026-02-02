import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const bookmarksApi = {
  /**
   * Get user's bookmarked posts
   */
  async getBookmarks() {
    try {
      console.log('[Bookmarks] getBookmarks');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) return [];

      const { data, error } = await supabase
        .from(DB.bookmarks.table)
        .select(`
          ${DB.bookmarks.postId},
          ${DB.bookmarks.createdAt}
        `)
        .eq(DB.bookmarks.userId, userData[DB.users.id])
        .order(DB.bookmarks.createdAt, { ascending: false });

      if (error) throw error;

      return (data || []).map((b: any) => String(b[DB.bookmarks.postId]));
    } catch (error) {
      console.error('[Bookmarks] getBookmarks error:', error);
      return [];
    }
  },

  /**
   * Toggle bookmark on post
   */
  async toggleBookmark(postId: string, isBookmarked: boolean) {
    try {
      console.log('[Bookmarks] toggleBookmark:', postId, 'isBookmarked:', isBookmarked);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.email, user.email)
        .single();

      if (!userData) throw new Error('User not found');

      if (isBookmarked) {
        // Remove bookmark
        await supabase
          .from(DB.bookmarks.table)
          .delete()
          .eq(DB.bookmarks.userId, userData[DB.users.id])
          .eq(DB.bookmarks.postId, parseInt(postId));
      } else {
        // Add bookmark
        await supabase
          .from(DB.bookmarks.table)
          .insert({
            [DB.bookmarks.userId]: userData[DB.users.id],
            [DB.bookmarks.postId]: parseInt(postId),
          });
      }

      return { success: true };
    } catch (error) {
      console.error('[Bookmarks] toggleBookmark error:', error);
      throw error;
    }
  },
};
