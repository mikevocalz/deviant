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
  hasLiked?: boolean;
  postId?: string;
  parentId?: string | null;
  replies?: Comment[];
}

// Extract avatar URL from various possible formats
function extractAvatarUrl(avatar: unknown, fallbackName: string): string {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=3EA4E5&color=fff`;

  if (!avatar) return fallback;

  // If it's already a valid URL string
  if (
    typeof avatar === "string" &&
    (avatar.startsWith("http://") || avatar.startsWith("https://"))
  ) {
    return avatar;
  }

  // If it's a media object with url property (from Payload upload field with depth)
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    if (avatarObj.url && typeof avatarObj.url === "string") {
      return avatarObj.url;
    }
  }

  return fallback;
}

// Transform API response to match Comment type
function transformComment(
  doc: Record<string, unknown>,
  options: { postId?: string; parentId?: string | null } = {},
): Comment {
  const author = doc.author as Record<string, unknown> | undefined;
  const authorName =
    (author?.name as string) || (author?.username as string) || "User";

  // PHASE 2 INSTRUMENTATION: Log comment author avatar for debugging
  if (__DEV__) {
    const rawAvatar = author?.avatar;
    console.log(
      `[transformComment] Comment ${doc.id}: author=${author?.username}, rawAvatar=${JSON.stringify(rawAvatar)?.slice(0, 100)}`,
    );
  }

  const resolvedPostId =
    typeof doc.post === "string"
      ? doc.post
      : typeof doc.postId === "string"
        ? doc.postId
        : options.postId;

  const resolvedParentId =
    options.parentId ??
    (doc.parentCommentId as string | null) ??
    (doc.parent as string | null);

  const hasLikedField =
    typeof doc.hasLiked === "boolean"
      ? doc.hasLiked
      : typeof doc.liked === "boolean"
        ? doc.liked
        : undefined;

  const likesCount = (doc.likesCount as number) || (doc.likes as number) || 0;

  const replies = ((doc.replies as Array<Record<string, unknown>>) || []).map(
    (reply) =>
      transformComment(reply, {
        postId: resolvedPostId,
        parentId: doc.id as string,
      }),
  );

  return {
    id: doc.id as string,
    username: (author?.username as string) || "user",
    avatar: extractAvatarUrl(author?.avatar, authorName),
    text: (doc.content as string) || (doc.text as string) || "", // CMS uses 'content', transform uses 'text'
    timeAgo: formatTimeAgo(doc.createdAt as string),
    likes: likesCount,
    hasLiked: hasLikedField,
    postId: resolvedPostId,
    parentId: resolvedParentId,
    replies,
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
      // Payload custom endpoint returns comments with replies already nested
      const response = await commentsApi.findByPost(postId, {
        limit,
      });

      // Transform comments - replies are already attached by the endpoint
      const commentsWithReplies = response.docs.map((doc: any) => {
        const comment = transformComment(doc, { postId });
        const replies = (doc.replies || []).map((reply: any) =>
          transformComment(reply, {
            postId,
            parentId: doc.id as string,
          }),
        );
        return {
          ...comment,
          replies,
        };
      });

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
      return response.docs.map((doc: any) =>
        transformComment(doc, { postId, parentId }),
      );
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

      const createdComment = transformComment(doc as Record<string, unknown>, {
        postId: cleanedPostId,
        parentId: data.parent || null,
      });
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
