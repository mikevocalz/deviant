import { supabase } from '../supabase/client';
import { DB } from '../supabase/db-map';

export const likesApi = {
  /**
   * Like a post
   */
  async likePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error('User not found');

      // Add like
      await supabase
        .from(DB.likes.table)
        .insert({
          [DB.likes.userId]: userData[DB.users.id],
          [DB.likes.postId]: parseInt(postId),
        });

      // Increment likes count
      await supabase.rpc('increment_post_likes', { post_id: parseInt(postId) });

      // Get updated count
      const { data: postData } = await supabase
        .from(DB.posts.table)
        .select(DB.posts.likesCount)
        .eq(DB.posts.id, postId)
        .single();

      return { liked: true, likes: postData?.[DB.posts.likesCount] || 0 };
    } catch (error) {
      console.error('[Likes] likePost error:', error);
      throw error;
    }
  },

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) throw new Error('User not found');

      // Remove like
      await supabase
        .from(DB.likes.table)
        .delete()
        .eq(DB.likes.userId, userData[DB.users.id])
        .eq(DB.likes.postId, parseInt(postId));

      // Decrement likes count
      await supabase.rpc('decrement_post_likes', { post_id: parseInt(postId) });

      // Get updated count
      const { data: postData } = await supabase
        .from(DB.posts.table)
        .select(DB.posts.likesCount)
        .eq(DB.posts.id, postId)
        .single();

      return { liked: false, likes: postData?.[DB.posts.likesCount] || 0 };
    } catch (error) {
      console.error('[Likes] unlikePost error:', error);
      throw error;
    }
  },

  /**
   * Toggle like on a post
   */
  async toggleLike(postId: string, isCurrentlyLiked: boolean): Promise<{ liked: boolean; likes: number }> {
    if (isCurrentlyLiked) {
      return this.unlikePost(postId);
    } else {
      return this.likePost(postId);
    }
  },

  /**
   * Check if current user has liked a post
   */
  async hasLiked(postId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: userData } = await supabase
        .from(DB.users.table)
        .select(DB.users.id)
        .eq(DB.users.authId, user.id)
        .single();

      if (!userData) return false;

      const { data } = await supabase
        .from(DB.likes.table)
        .select('id')
        .eq(DB.likes.userId, userData[DB.users.id])
        .eq(DB.likes.postId, parseInt(postId))
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  },
};
