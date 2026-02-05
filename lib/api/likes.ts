import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";

export const likesApi = {
  /**
   * Like a post
   */
  async likePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const postIdInt = parseInt(postId);

      // Add like
      await supabase.from(DB.likes.table).insert({
        [DB.likes.userId]: userId,
        [DB.likes.postId]: postIdInt,
      });

      // Increment likes count
      await supabase.rpc("increment_post_likes", { post_id: parseInt(postId) });

      // Get updated count
      const { data: postData } = await supabase
        .from(DB.posts.table)
        .select(DB.posts.likesCount)
        .eq(DB.posts.id, postId)
        .single();

      return { liked: true, likes: postData?.[DB.posts.likesCount] || 0 };
    } catch (error) {
      console.error("[Likes] likePost error:", error);
      throw error;
    }
  },

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const postIdInt = parseInt(postId);

      // Remove like
      await supabase
        .from(DB.likes.table)
        .delete()
        .eq(DB.likes.userId, userId)
        .eq(DB.likes.postId, postIdInt);

      // Decrement likes count
      await supabase.rpc("decrement_post_likes", { post_id: postIdInt });

      // Get updated count
      const { data: postData } = await supabase
        .from(DB.posts.table)
        .select(DB.posts.likesCount)
        .eq(DB.posts.id, postId)
        .single();

      return { liked: false, likes: postData?.[DB.posts.likesCount] || 0 };
    } catch (error) {
      console.error("[Likes] unlikePost error:", error);
      throw error;
    }
  },

  /**
   * Toggle like on a post
   */
  async toggleLike(
    postId: string,
    isCurrentlyLiked: boolean,
  ): Promise<{ liked: boolean; likes: number }> {
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
      const userId = getCurrentUserIdInt();
      if (!userId) return false;

      const { data } = await supabase
        .from(DB.likes.table)
        .select("id")
        .eq(DB.likes.userId, userId)
        .eq(DB.likes.postId, parseInt(postId))
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  },
};
