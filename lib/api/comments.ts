/**
 * Comments API - fetches real comment data from Payload CMS
 */

import {
  comments as commentsApi,
  notifications,
  posts,
} from "@/lib/api-client";

// Extract @mentions from text
function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]); // Get username without @
  }
  return [...new Set(mentions)]; // Remove duplicates
}

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
  // Fetch comments for a post with threaded replies
  async getComments(postId: string, limit: number = 50): Promise<Comment[]> {
    try {
      // Fetch top-level comments (parent: null)
      const response = await commentsApi.findByPost(postId, {
        limit,
        depth: 2,
      });

      // Transform top-level comments
      const topLevelComments = response.docs.map(transformComment);

      // For each top-level comment, fetch its replies and nest them
      const commentsWithReplies = await Promise.all(
        topLevelComments.map(async (comment) => {
          try {
            // Pass postId along with parentId for reply fetching
            const repliesResponse = await commentsApi.findByParent(
              comment.id,
              postId,
              {
                limit: 50,
                depth: 1,
              },
            );

            // Transform and attach replies
            const replies = repliesResponse.docs.map(transformComment);
            return {
              ...comment,
              replies: replies.length > 0 ? replies : [],
            };
          } catch (replyError) {
            console.warn(
              "[commentsApi] Error fetching replies for comment:",
              comment.id,
              replyError,
            );
            return { ...comment, replies: [] };
          }
        }),
      );

      console.log(
        "[commentsApi] Fetched",
        commentsWithReplies.length,
        "comments with replies",
      );
      return commentsWithReplies;
    } catch (error) {
      console.error("[commentsApi] getComments error:", error);
      return [];
    }
  },

  // Fetch replies to a comment
  async getReplies(
    parentId: string,
    postId: string,
    limit: number = 50,
  ): Promise<Comment[]> {
    try {
      const response = await commentsApi.findByParent(parentId, postId, {
        limit,
        depth: 2,
      });
      return response.docs.map(transformComment);
    } catch (error) {
      console.error("[commentsApi] getReplies error:", error);
      return [];
    }
  },

  // Create a new comment
  async createComment(data: {
    post: string;
    text: string;
    parent?: string;
    authorUsername?: string;
    authorId?: string; // Payload CMS user ID from Zustand store
    clientMutationId?: string; // For idempotency - prevents duplicate submissions
  }): Promise<Comment> {
    try {
      // Clean and validate post ID
      const rawPostId = data.post;
      // Remove any spaces or invalid characters
      const cleanedPostId = String(rawPostId).trim().replace(/\s+/g, "");
      const numericPostId = parseInt(cleanedPostId, 10);

      console.log("[commentsApi] createComment called with:", {
        rawPost: rawPostId,
        cleanedPost: cleanedPostId,
        text: data.text?.slice(0, 50),
        authorUsername: data.authorUsername,
        authorId: data.authorId, // CRITICAL: Must have Payload CMS user ID
      });

      // Validate post ID - should be a valid MongoDB ObjectID (24 hex chars) or numeric
      const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(cleanedPostId);
      const isNumericId = !isNaN(numericPostId);

      if (!isValidObjectId && !isNumericId) {
        console.error("[commentsApi] Invalid post ID format:", rawPostId);
        throw new Error("Invalid post ID format. Cannot create comment.");
      }

      // Validate required fields
      if (!data.text || !data.text.trim()) {
        throw new Error("Comment text is required");
      }

      if (!data.authorUsername) {
        throw new Error("You must be logged in to comment");
      }

      // CRITICAL: Ensure authorId exists - backend requires author field
      if (!data.authorId) {
        console.error(
          "[commentsApi] MISSING authorId! User may not have Payload CMS ID",
        );
        throw new Error("User ID not found. Please log out and log back in.");
      }

      // Send to API - the API route handles author lookup and transformation
      // Include both authorId (from Zustand) and authorUsername for fallback
      const commentPayload = {
        post: cleanedPostId,
        text: data.text.trim(), // API route expects 'text', it transforms to 'content'
        authorUsername: data.authorUsername,
        authorId: data.authorId, // Payload CMS user ID from Zustand store
        parent: data.parent || undefined,
        clientMutationId: data.clientMutationId, // For server-side idempotency
      };
      console.log(
        "[commentsApi] Sending to API:",
        JSON.stringify(commentPayload, null, 2),
      );
      console.log("[commentsApi] Payload details:", {
        post: cleanedPostId,
        textLength: data.text.trim().length,
        authorUsername: data.authorUsername,
        hasParent: !!data.parent,
      });

      let doc;
      try {
        doc = await commentsApi.create(commentPayload);
        console.log(
          "[commentsApi] ✓ Comment created successfully:",
          doc?.id || "unknown",
        );
      } catch (apiError: any) {
        console.error("[commentsApi] API call failed:", {
          message: apiError?.message,
          error: apiError?.error,
          errors: apiError?.errors,
          status: apiError?.status,
          response: apiError?.response,
        });
        throw apiError;
      }

      const createdComment = transformComment(doc as Record<string, unknown>);
      console.log("[commentsApi] Transformed comment:", createdComment.id);

      // Fire-and-forget: Create notifications asynchronously without blocking the response
      // This makes comments post instantly while notifications happen in the background
      const createNotificationsAsync = async () => {
        try {
          const commentText = data.text.trim();
          const mentions = extractMentions(commentText);
          const senderUsername = data.authorUsername || "";

          // Get post details to notify the author
          let postAuthorUsername: string | undefined;
          try {
            const postDoc = await posts.findByID(cleanedPostId);
            const postAuthor = (postDoc as Record<string, unknown>)?.author;
            if (typeof postAuthor === "object" && postAuthor !== null) {
              postAuthorUsername = (postAuthor as Record<string, unknown>)
                .username as string;
            }
          } catch (postError) {
            console.log(
              "[commentsApi] Could not fetch post for notification:",
              postError,
            );
          }

          // NOTE: Notifications are now created server-side in Payload hooks
          // when comments are created. No client-side notification creation needed.
          console.log(
            "[commentsApi] Comment created, notifications handled server-side",
          );
        } catch (notificationError) {
          console.error(
            "[commentsApi] Notification setup error:",
            notificationError,
          );
        }
      };

      // Start notification creation without awaiting
      createNotificationsAsync();

      return createdComment;
    } catch (error) {
      console.error("[commentsApi] createComment error:", error);
      throw error;
    }
  },

  // Like/unlike a comment - uses central api-client for consistent auth
  async likeComment(
    commentId: string,
    isLiked: boolean,
  ): Promise<{ commentId: string; likes: number; liked: boolean }> {
    try {
      // Import likes from central api-client for consistent auth handling
      const { likes: likesApi } = await import("@/lib/api-client");

      // Use central api-client's like/unlike for consistent auth
      const response = isLiked
        ? await likesApi.unlikeComment(commentId)
        : await likesApi.likeComment(commentId);

      return {
        commentId,
        likes: response.likesCount,
        liked: response.liked,
      };
    } catch (error) {
      console.error("[commentsApi] likeComment error:", error);
      throw error;
    }
  },
};
