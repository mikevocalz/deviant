import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import type { Comment } from "@/lib/types";
import { getCurrentUserIdInt } from "./auth-helper";
import { requireBetterAuthToken } from "../auth/identity";

interface AddCommentResponse {
  ok: boolean;
  data?: { comment: any };
  error?: { code: string; message: string };
}

interface DeleteCommentResponse {
  ok: boolean;
  data?: { success: boolean };
  error?: { code: string; message: string };
}

export const commentsApi = {
  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit: number = 50) {
    try {
      console.log("[Comments] getComments, postId:", postId);

      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn("[Comments] Invalid postId:", postId);
        return [];
      }

      const viewerId = getCurrentUserIdInt();

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
          ),
          comment_likes!left(user_id)
        `,
        )
        .eq(DB.comments.postId, postIdInt)
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
          hasLiked: viewerId
            ? Array.isArray(c.comment_likes) &&
              c.comment_likes.some((l: any) => l.user_id === viewerId)
            : false,
          replies: [] as Comment[],
        }),
      );
    } catch (error) {
      console.error("[Comments] getComments error:", error);
      return [];
    }
  },

  /**
   * Add comment to post via Edge Function
   */
  async addComment(postId: string, content: string) {
    try {
      console.log("[Comments] addComment via Edge Function, postId:", postId);

      const token = await requireBetterAuthToken();
      const postIdInt = parseInt(postId);

      const { data, error } =
        await supabase.functions.invoke<AddCommentResponse>("add-comment", {
          body: { postId: postIdInt, content },
          headers: { Authorization: `Bearer ${token}` },
        });

      if (error) {
        console.error("[Comments] Edge Function error:", error);
        throw new Error(error.message || "Failed to add comment");
      }

      if (!data?.ok || !data?.data?.comment) {
        const errorMessage = data?.error?.message || "Failed to add comment";
        throw new Error(errorMessage);
      }

      console.log("[Comments] addComment result:", data.data.comment);
      return data.data.comment;
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
    return commentsApi.addComment(data.post, data.text);
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

      const { data, error } = await supabase.rpc("toggle_comment_like", {
        p_comment_id: parseInt(commentId),
        p_user_id: userId,
      });

      if (error) throw error;

      return {
        liked: (data as any)?.liked ?? !isLiked,
        likes: (data as any)?.likes_count ?? 0,
      };
    } catch (error) {
      console.error("[Comments] likeComment error:", error);
      throw error;
    }
  },

  /**
   * Delete comment via Edge Function
   */
  async deleteComment(commentId: string, _postId?: string) {
    try {
      console.log("[Comments] deleteComment via Edge Function:", commentId);

      const token = await requireBetterAuthToken();
      const commentIdInt = parseInt(commentId);

      const { data, error } =
        await supabase.functions.invoke<DeleteCommentResponse>(
          "delete-comment",
          {
            body: { commentId: commentIdInt },
            headers: { Authorization: `Bearer ${token}` },
          },
        );

      if (error) {
        console.error("[Comments] Edge Function error:", error);
        throw new Error(error.message || "Failed to delete comment");
      }

      if (!data?.ok) {
        const errorMessage = data?.error?.message || "Failed to delete comment";
        throw new Error(errorMessage);
      }

      console.log("[Comments] deleteComment success");
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
