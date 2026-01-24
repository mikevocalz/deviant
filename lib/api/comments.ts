/**
 * Comments API - fetches real comment data from Payload CMS
 */

import { comments as commentsApi } from "@/lib/api-client";

export interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  replies?: Comment[];
}

// Transform API response to match Comment type
function transformComment(doc: Record<string, unknown>): Comment {
  const author = doc.author as Record<string, unknown> | undefined;

  return {
    id: doc.id as string,
    username: (author?.username as string) || "user",
    avatar:
      (author?.avatar as string) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent((author?.name as string) || "User")}`,
    text: (doc.content as string) || (doc.text as string) || "", // CMS uses 'content', transform uses 'text'
    timeAgo: formatTimeAgo(doc.createdAt as string),
    likes: (doc.likes as number) || 0,
    replies: ((doc.replies as Array<Record<string, unknown>>) || []).map(
      transformComment,
    ),
  };
}

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export const commentsApiClient = {
  // Fetch comments for a post
  async getComments(postId: string): Promise<Comment[]> {
    try {
      const response = await commentsApi.findByPost(postId, { limit: 50 });
      return response.docs.map(transformComment);
    } catch (error) {
      console.error("[commentsApi] getComments error:", error);
      return [];
    }
  },

  // Create a new comment
  async createComment(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
  }): Promise<Comment> {
    try {
      const doc = await commentsApi.create(data as any);
      return transformComment(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[commentsApi] createComment error:", error);
      throw error;
    }
  },
};
