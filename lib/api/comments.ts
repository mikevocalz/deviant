/**
 * Comments API - fetches real comment data from Payload CMS
 */

import { Platform } from "react-native";

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

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
  // Fetch comments for a post (uses custom endpoint)
  async getComments(postId: string, limit: number = 50): Promise<Comment[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/posts/${postId}/comments?limit=${limit}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[commentsApi] getComments failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformComment);
    } catch (error) {
      console.error("[commentsApi] getComments error:", error);
      return [];
    }
  },

  // Fetch replies to a comment (not implemented - usually comments have replies nested)
  async getReplies(parentId: string, limit: number = 50): Promise<Comment[]> {
    try {
      // NOTE: Replies should be nested in the comment object with depth: 2
      // If you need a separate endpoint for replies, implement it in Payload
      console.warn("[commentsApi] getReplies not yet implemented with custom endpoint");
      return [];
    } catch (error) {
      console.error("[commentsApi] getReplies error:", error);
      return [];
    }
  },

  // Create a new comment (uses custom endpoint)
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
      const cleanedPostId = String(rawPostId).trim().replace(/\s+/g, '');
      const numericPostId = parseInt(cleanedPostId, 10);

      console.log("[commentsApi] createComment called with:", {
        rawPost: rawPostId,
        cleanedPost: cleanedPostId,
        text: data.text?.slice(0, 50),
        authorUsername: data.authorUsername,
        authorId: data.authorId, // CRITICAL: Must have Payload CMS user ID
      });
      
      // Validate post ID
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
      
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      // Use custom comment creation endpoint
      const response = await fetch(
        `${apiUrl}/api/posts/${cleanedPostId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: data.text.trim(), // Payload expects 'content'
            parent: data.parent || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create comment: ${response.status}`);
      }

      const doc = await response.json();
      console.log("[commentsApi] ✓ Comment created successfully:", doc?.id || "unknown");
      
      const createdComment = transformComment(doc as Record<string, unknown>);
      
      // NOTE: Notifications are typically handled server-side in Payload endpoints
      // If needed, you can implement a separate notification endpoint call here
      
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
