import type { Post } from "@/lib/types";
import { Platform } from "react-native";

const PAGE_SIZE = 10;

// Helper to resolve media URLs (handles relative paths and CDN URLs)
function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Assume Bunny CDN base URL for relative paths
  const cdnBase =
    process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";
  return `${cdnBase}/${url}`;
}

// Helper to extract avatar URL from various formats
function extractAvatarUrl(avatar: unknown, fallbackName?: string): string {
  if (!avatar) {
    return fallbackName
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`
      : "";
  }
  if (typeof avatar === "string") return avatar;
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    if (avatarObj.url && typeof avatarObj.url === "string") {
      return avatarObj.url;
    }
  }
  return "";
}

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
    const response = await fetch(`${apiUrl}/api/users/${username}/profile`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

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
// CRITICAL: Properly extract media fields - video posts may have different structure
function toNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function transformPost(doc: Record<string, unknown>): Post {
  // PHASE 0 INSTRUMENTATION: Log raw post data for likes/avatar debugging
  if (__DEV__) {
    const rawLikesCount = doc.likesCount;
    const rawLikes = doc.likes;
    const rawViewerHasLiked = doc.viewerHasLiked ?? doc.isLiked;
    const author = doc.author as Record<string, unknown> | undefined;
    const authorAvatarUrl = author?.avatarUrl || author?.avatar;
    console.log(
      `[transformPost] Post ${String(doc.id).slice(0, 8)}: likesCount=${rawLikesCount}, viewerHasLiked=${rawViewerHasLiked}, author.avatarUrl=${authorAvatarUrl ? "present" : "MISSING"}`,
    );
  }

  const rawMedia = (doc.media as Array<Record<string, unknown>>) || [];

  // Safely transform each media item with proper field extraction
  const media = rawMedia
    .map((m) => {
      // Handle case where m might be null/undefined
      if (!m) return null;

      // Extract URL - could be in 'url' field or 'filename' for uploaded media
      // Payload CMS may store media as relationship objects with nested data
      const rawUrl = String(m.url || m.filename || "");
      const url = resolveMediaUrl(rawUrl);
      const rawThumb = m.thumbnail as string | undefined;
      const thumbnail = rawThumb ? resolveMediaUrl(rawThumb) : undefined;

      // Extract type - default to 'image' if not specified
      // Video posts should have type: 'video' set
      const type = (m.type as "image" | "video") || "image";

      // Skip media without valid URL
      if (!url) {
        console.warn("[transformPost] Media item missing URL:", m);
        return null;
      }

      return { type, url, ...(thumbnail && { thumbnail }) };
    })
    .filter(
      (m): m is { type: "image" | "video"; url: string; thumbnail?: string } =>
        m !== null && typeof m.url === "string",
    );

  // Log media transformation for debugging
  const rawId = doc.id;
  const normalizedId =
    typeof rawId === "string" ? rawId : rawId != null ? String(rawId) : "";

  if (__DEV__ && !normalizedId) {
    console.warn("[transformPost] Missing post ID:", doc);
  }

  if (rawMedia.length > 0) {
    console.log("[transformPost] Media transform:", {
      postId: normalizedId,
      rawCount: rawMedia.length,
      transformedCount: media.length,
      hasVideo: media.some((m) => m.type === "video"),
      thumbnails: media.map((m) => ({
        type: m.type,
        hasThumbnail: !!m.thumbnail,
        thumbnailUrl: m.thumbnail?.substring(0, 60),
      })),
    });
  }

  const author = doc.author as Record<string, unknown> | undefined;
  const authorName =
    (author?.name as string) || (author?.username as string) || "User";

  const likes = toNumber(doc.likesCount ?? doc.likes);
  // CRITICAL: Extract viewerHasLiked from API response for proper like state
  const viewerHasLiked = doc.viewerHasLiked === true;

  return {
    id: normalizedId,
    author: {
      id: author?.id ? String(author.id) : undefined,
      username: (author?.username as string) || "unknown",
      avatar: extractAvatarUrl(author?.avatar, authorName),
      verified: (author?.isVerified as boolean) || false,
      name: authorName,
    },
    media,
    caption: (doc.content || doc.caption) as string,
    likes,
    viewerHasLiked, // CRITICAL: Include viewer's like state
    comments: [],
    timeAgo: formatTimeAgo(doc.createdAt as string),
    createdAt: doc.createdAt as string,
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
      const response = await fetch(`${apiUrl}/api/posts/feed?limit=20`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

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

  // Fetch feed posts with pagination (infinite scroll) using CUSTOM feed endpoint
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

      const url = `${apiUrl}/api/posts/feed?page=${page}&limit=${PAGE_SIZE}`;
      console.log("[postsApi] getFeedPostsPaginated fetching:", url);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(
        "[postsApi] getFeedPostsPaginated raw result:",
        JSON.stringify(result).substring(0, 500),
      );

      const posts = (result.docs || []).map(transformPost);
      console.log(
        "[postsApi] getFeedPostsPaginated posts count:",
        posts.length,
      );
      if (posts.length > 0) {
        console.log(
          "[postsApi] First post ID:",
          posts[0].id,
          "caption:",
          posts[0].caption?.substring(0, 30),
        );
      }

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
      console.log("[postsApi] getProfilePosts called with userId:", userId);

      if (!userId || userId === "skip") return [];

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();
      console.log("[postsApi] Has auth token:", !!token);

      // Use custom profile posts endpoint (returns JSON)
      const url = `${apiUrl}/api/users/${userId}/posts?limit=50`;
      console.log("[postsApi] Fetching from URL:", url);

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      console.log("[postsApi] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[postsApi] getProfilePosts failed:",
          response.status,
          errorText,
        );
        return [];
      }

      const result = await response.json();
      console.log("[postsApi] Got posts count:", result.docs?.length || 0);
      return (result.docs || []).map(transformPost);
    } catch (error) {
      console.error("[postsApi] getProfilePosts error:", error);
      throw error;
    }
  },

  // Fetch single post by ID (uses custom endpoint)
  async getPostById(id: string): Promise<Post | null> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return null;

      const token = await getAuthToken();

      // Use custom post endpoint (returns JSON)
      const response = await fetch(`${apiUrl}/api/posts/${id}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

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

  // Like/unlike a post - uses central api-client for consistent auth
  async likePost(
    postId: string,
    isLiked: boolean,
  ): Promise<{ postId: string; likes: number; liked: boolean }> {
    try {
      // Import likes from central api-client for consistent auth handling
      const { likes: likesApi } = await import("@/lib/api-client");

      // Use central api-client's like/unlike for consistent auth
      const response = isLiked
        ? await likesApi.unlikePost(postId)
        : await likesApi.likePost(postId);

      return {
        postId,
        likes: response.likesCount,
        liked: response.liked,
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
    media?: Array<{ type: string; url: string; thumbnail?: string }>;
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
          authorId =
            (await getUserIdByUsername(data.authorUsername)) || undefined;
          if (authorId) {
            console.log("[postsApi] Found author ID:", authorId);
          } else {
            console.warn(
              "[postsApi] User not found in CMS:",
              data.authorUsername,
            );
          }
        }
      }

      // Create post via custom endpoint
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(`${apiUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: data.caption,
          caption: data.caption,
          location: data.location,
          media: data.media || [],
          isNSFW: data.isNSFW || false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to create post: ${response.status}`,
        );
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

      const response = await fetch(`${apiUrl}/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to delete post: ${response.status}`,
        );
      }

      return postId;
    } catch (error) {
      console.error("[postsApi] deletePost error:", error);
      throw error;
    }
  },
};
