import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";
import { requireBetterAuthToken } from "../auth/identity";

interface ToggleLikeResponse {
  ok: boolean;
  data?: { liked: boolean; likesCount: number };
  error?: { code: string; message: string };
}

export const likesApi = {
  /**
   * Toggle like on a post via Edge Function
   */
  async toggleLike(
    postId: string,
    _isCurrentlyLiked?: boolean,
  ): Promise<{ liked: boolean; likes: number }> {
    try {
      console.log("[Likes] toggleLike via Edge Function:", postId);

      const token = await requireBetterAuthToken();
      const postIdInt = parseInt(postId);

      const { data, error } =
        await supabase.functions.invoke<ToggleLikeResponse>("toggle-like", {
          body: { postId: postIdInt },
          headers: { Authorization: `Bearer ${token}` },
        });

      if (error) {
        console.error("[Likes] Edge Function error:", error);
        throw new Error(error.message || "Failed to toggle like");
      }

      if (!data?.ok || !data?.data) {
        const errorMessage = data?.error?.message || "Failed to toggle like";
        console.error("[Likes] Toggle failed:", errorMessage);
        throw new Error(errorMessage);
      }

      console.log("[Likes] toggleLike result:", data.data);
      return { liked: data.data.liked, likes: data.data.likesCount };
    } catch (error) {
      console.error("[Likes] toggleLike error:", error);
      throw error;
    }
  },

  /**
   * Like a post (calls toggleLike)
   */
  async likePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    return this.toggleLike(postId);
  },

  /**
   * Unlike a post (calls toggleLike)
   */
  async unlikePost(postId: string): Promise<{ liked: boolean; likes: number }> {
    return this.toggleLike(postId);
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
