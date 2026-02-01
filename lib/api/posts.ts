import type { Post } from "@/lib/types";
import { Platform } from "react-native";

const PAGE_SIZE = 10;

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

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

// Helper function to lookup user ID by username using Payload custom endpoint
async function getUserIdByUsername(username: string): Promise<string | null> {
  if (!username) return null;
  
  // Check cache first
  if (userIdCache[username]) {
    return userIdCache[username];
  }
  
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return null;

    const token = await getAuthToken();
    
    // Use custom profile endpoint (returns JSON)
    const response = await fetch(
      `${apiUrl}/api/users/${username}/profile`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      }
    );
    
    if (!response.ok) return null;
    
    const profile = await response.json();
    if (profile && profile.id) {
      const userId = String(profile.id);
      userIdCache[username] = userId;
      return userId;
    }
  } catch (error) {
    console.error("[postsApi] getUserIdByUsername error:", error);
  }
  
  return null;
}

// Helper function to lookup user ID by username using Payload custom endpoint
async function getUserIdByUsername(username: string): Promise<string | null> {
  if (!username) return null;
  
  // Check cache first
  if (userIdCache[username]) {
    return userIdCache[username];
  }
  
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return null;

    const token = await getAuthToken();
    
    // Use custom profile endpoint (returns JSON)
    const response = await fetch(
      `${apiUrl}/api/users/${username}/profile`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      }
    );
    
    if (!response.ok) return null;
    
    const profile = await response.json();
    if (profile && profile.id) {
      const userId = String(profile.id);
      userIdCache[username] = userId;
      return userId;
    }
  } catch (error) {
    console.error("[postsApi] getUserIdByUsername error:", error);
  }
  
  return null;
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

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: number | null;
  hasMore: boolean;
}

// Transform API response to match Post type
function transformPost(doc: Record<string, unknown>): Post {
  const media =
    (doc.media as Array<{ type: "image" | "video"; url: string }>) || [];

  return {
    id: doc.id as string,
    author: {
      username:
        ((doc.author as Record<string, unknown>)?.username as string) ||
        "unknown",
      avatar: (doc.author as Record<string, unknown>)?.avatar as string,
      verified:
        ((doc.author as Record<string, unknown>)?.isVerified as boolean) ||
        false,
      name: (doc.author as Record<string, unknown>)?.name as string,
    },
    media,
    caption: doc.caption as string,
    likes: (doc.likes as number) || 0,
    comments: [],
    timeAgo: formatTimeAgo(doc.createdAt as string),
    location: doc.location as string,
    isNSFW: doc.isNSFW as boolean,
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
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Real API functions
export const postsApi = {
  // Fetch feed posts (use getFeedPostsPaginated instead for infinite scroll)
  async getFeedPosts(): Promise<Post[]> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      // Use custom feed endpoint (returns JSON)
      const response = await fetch(
        `${apiUrl}/api/posts/feed?limit=20`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[postsApi] getFeedPosts failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformPost);
    } catch (error) {
      console.error("[postsApi] getFeedPosts error:", error);
      return [];
    }
  },

  // Fetch feed posts with pagination (infinite scroll)
  async getFeedPostsPaginated(
    cursor: number = 0,
  ): Promise<PaginatedResponse<Post>> {
    try {
      // Use Payload's custom /api/posts/feed endpoint (returns JSON)
      const page = Math.floor(cursor / PAGE_SIZE) + 1;
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      
      if (!apiUrl) {
        console.error("[postsApi] EXPO_PUBLIC_API_URL not configured");
        return { data: [], nextCursor: null, hasMore: false };
      }

      // Get auth token
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${apiUrl}/api/posts/feed?page=${page}&limit=${PAGE_SIZE}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        data: (result.docs || []).map(transformPost),
        nextCursor: result.hasNextPage ? cursor + PAGE_SIZE : null,
        hasMore: result.hasNextPage || false,
      };
    } catch (error) {
      console.error("[postsApi] getFeedPostsPaginated error:", error);
      return { data: [], nextCursor: null, hasMore: false };
    }
  },

  // Fetch profile posts (uses custom endpoint)
  async getProfilePosts(userId: string): Promise<Post[]> {
    try {
      if (!userId || userId === "skip") return [];

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      // Use custom profile posts endpoint (returns JSON)
      const response = await fetch(
        `${apiUrl}/api/users/${userId}/posts?limit=50`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[postsApi] getProfilePosts failed:", response.status);
        return [];
      }

      const result = await response.json();
      return (result.docs || []).map(transformPost);
    } catch (error) {
      console.error("[postsApi] getProfilePosts error:", error);
      return [];
    }
  },

  // Fetch single post by ID (uses custom endpoint)
  async getPostById(id: string): Promise<Post | null> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return null;

      const token = await getAuthToken();

      // Use custom post endpoint (returns JSON)
      const response = await fetch(
        `${apiUrl}/api/posts/${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[postsApi] getPostById failed:", response.status);
        return null;
      }

      const doc = await response.json();
      return transformPost(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[postsApi] getPostById error:", error);
      return null;
    }
  },

  // Like/unlike a post
  async likePost(
    postId: string,
    isLiked: boolean,
  ): Promise<{ postId: string; likes: number; liked: boolean }> {
    try {
      const action = isLiked ? "unlike" : "like";
      const API_BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || process.env.EXPO_PUBLIC_API_URL || "";
      const url = `${API_BASE_URL}/api/posts/${postId}/like`;
      
      // Get auth token and cookies
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

      const response = await fetch(url, {
        method: "POST",
        headers,
        credentials: API_BASE_URL ? "omit" : "include",
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          // Response is not JSON, use status text
          errorMessage = `API error: ${response.status} ${response.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      return {
        postId,
        likes: data.likes,
        liked: data.liked,
      };
    } catch (error) {
      console.error("[postsApi] likePost error:", error);
      throw error;
    }
  },

  // Create a new post
  async createPost(data: {
    author?: string;
    authorUsername?: string;
    media?: Array<{ type: string; url: string }>;
    caption?: string;
    location?: string;
    isNSFW?: boolean;
  }): Promise<Post> {
    console.log("[postsApi] createPost called with:", JSON.stringify(data));
    console.log(
      "[postsApi] API_URL:",
      process.env.EXPO_PUBLIC_API_URL || "(not set)",
    );
    try {
      // Look up the Payload CMS user ID by username
      let authorId: string | undefined;
      
      if (data.authorUsername) {
        // Check cache first
        if (userIdCache[data.authorUsername]) {
          authorId = userIdCache[data.authorUsername];
          console.log("[postsApi] Using cached author ID:", authorId);
        } else {
          // Look up user via custom profile endpoint
          authorId = await getUserIdByUsername(data.authorUsername) || undefined;
          if (authorId) {
            console.log("[postsApi] Found author ID:", authorId);
          } else {
            console.warn("[postsApi] User not found in CMS:", data.authorUsername);
          }
        }
      }
      
      // Create post via custom endpoint
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: data.caption,
            caption: data.caption,
            location: data.location,
            media: data.media || [],
            isNSFW: data.isNSFW || false,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create post: ${response.status}`);
      }

      const doc = await response.json();
      console.log("[postsApi] createPost success:", JSON.stringify(doc));
      
      const newPost = transformPost(doc as Record<string, unknown>);
      
      // Note: Mentions notifications should be handled server-side in Payload endpoint
      // If needed, you can add a separate notification endpoint call here
      
      return newPost;
    } catch (error: any) {
      console.error("[postsApi] createPost error:", error);
      console.error("[postsApi] Error message:", error?.message);
      console.error("[postsApi] Error status:", error?.status);
      throw error;
    }
  },

  // Delete a post (uses custom endpoint)
  async deletePost(postId: string): Promise<string> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/posts/${postId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete post: ${response.status}`);
      }

      return postId;
    } catch (error) {
      console.error("[postsApi] deletePost error:", error);
      throw error;
    }
  },
};
