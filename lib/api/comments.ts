import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import type { Comment } from "@/lib/types";
import { getCurrentUserIdInt } from "./auth-helper";

export const commentsApi = {
  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit: number = 50) {
    try {
      console.log("[Comments] getComments, postId:", postId);

      const { data, error } = await supabase
        .from(DB.comments.table)
        .select(
          `
          *,
          author:${DB.comments.authorId}(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            avatar:${DB.users.avatarId}(url)
          )
        `,
        )
        .eq(DB.comments.postId, parseInt(postId))
        .order(DB.comments.createdAt, { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(
        (c: any): Comment => ({
          id: String(c[DB.comments.id]),
          username: c.author?.[DB.users.username] || "unknown",
          avatar: c.author?.avatar?.url || "",
          text: c[DB.comments.content] || "",
          timeAgo: formatTimeAgo(c[DB.comments.createdAt]),
          likes: Number(c[DB.comments.likesCount]) || 0,
          hasLiked: false, // TODO: implement viewer like state
          replies: [] as Comment[], // TODO: implement nested replies
        }),
      );
    } catch (error) {
      console.error("[Comments] getComments error:", error);
      return [];
    }
  },

  /**
   * Add comment to post
   */
  async addComment(postId: string, content: string) {
    try {
      console.log("[Comments] addComment, postId:", postId);

      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from(DB.comments.table)
        .insert({
          [DB.comments.postId]: parseInt(postId),
          [DB.comments.authorId]: userId,
          [DB.comments.content]: content,
          [DB.comments.likesCount]: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment post comments count
      await supabase.rpc("increment_post_comments", {
        post_id: parseInt(postId),
      });

      return data;
    } catch (error) {
      console.error("[Comments] addComment error:", error);
      throw error;
    }
  },

  /**
   * Create comment (wrapper for addComment with object parameter)
   */
  async createComment(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
    authorId?: string;
    clientMutationId?: string;
  }) {
    return this.addComment(data.post, data.text);
  },

  /**
   * Like/unlike comment
   */
  async likeComment(
    commentId: string,
    isLiked: boolean,
  ): Promise<{ liked: boolean; likes: number }> {
    try {
      console.log("[Comments] likeComment:", commentId, "isLiked:", isLiked);

      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      const newLikedState = !isLiked;

      if (newLikedState) {
        // Add like - using comment_likes table if it exists, otherwise update count directly
        await supabase.rpc("increment_comment_likes", {
          comment_id: parseInt(commentId),
        });
      } else {
        await supabase.rpc("decrement_comment_likes", {
          comment_id: parseInt(commentId),
        });
      }

      // Get updated likes count
      const { data: commentData } = await supabase
        .from(DB.comments.table)
        .select(DB.comments.likesCount)
        .eq(DB.comments.id, commentId)
        .single();

      return {
        liked: newLikedState,
        likes: commentData?.[DB.comments.likesCount] || 0,
      };
    } catch (error) {
      console.error("[Comments] likeComment error:", error);
      throw error;
    }
  },

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, postId: string) {
    try {
      const { error } = await supabase
        .from(DB.comments.table)
        .delete()
        .eq(DB.comments.id, parseInt(commentId));

      if (error) throw error;

      // Decrement post comments count
      await supabase.rpc("decrement_post_comments", {
        post_id: parseInt(postId),
      });

      return { success: true };
    } catch (error) {
      console.error("[Comments] deleteComment error:", error);
      throw error;
    }
  },

  /**
   * Get replies to a comment
   */
  async getReplies(
    parentId: string,
    postId: string,
    limit: number = 50,
  ): Promise<Comment[]> {
    try {
      console.log("[Comments] getReplies, parentId:", parentId);
      // TODO: Implement when nested comments are supported
      return [];
    } catch (error) {
      console.error("[Comments] getReplies error:", error);
      return [];
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}
