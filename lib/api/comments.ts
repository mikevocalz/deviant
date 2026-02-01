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
        authorUsername: data.authorUsername 
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

  // Like/unlike a comment
  async likeComment(
    commentId: string,
    isLiked: boolean,
  ): Promise<{ commentId: string; likes: number; liked: boolean }> {
    try {
      const action = isLiked ? "unlike" : "like";
      const API_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";
      const url = `${API_BASE_URL}/api/comments/${commentId}/like`;
      
      const { getAuthToken, getAuthCookies } = await import("@/lib/auth-client");
      const authToken = await getAuthToken();
      const authCookies = getAuthCookies();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (authToken) {
        headers["Authorization"] = `JWT ${authToken}`;
      }
      
      if (authCookies) {
        headers["Cookie"] = authCookies;
      }

      const fetchResponse = await fetch(url, {
        method: "POST",
        headers,
        credentials: API_BASE_URL ? "omit" : "include",
        body: JSON.stringify({ action }),
      });

      if (!fetchResponse.ok) {
        let errorMessage = `API error: ${fetchResponse.status}`;
        try {
          const errorData = await fetchResponse.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          // Response is not JSON, use status text
          errorMessage = `API error: ${fetchResponse.status} ${fetchResponse.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const data = await fetchResponse.json();

      return {
        commentId,
        likes: data.likes,
        liked: data.liked,
      };
    } catch (error) {
      console.error("[commentsApi] likeComment error:", error);
      throw error;
    }
  },
};
