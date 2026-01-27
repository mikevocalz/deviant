import { posts, notifications, users } from "@/lib/api-client";
import type { Post } from "@/lib/types";

const PAGE_SIZE = 10;

// Cache for user ID lookups to avoid repeated API calls
const userIdCache: Record<string, string> = {};

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
function transformPost(doc: Record<string, unknown>): Post {
  const rawMedia = (doc.media as Array<Record<string, unknown>>) || [];

  // Safely transform each media item with proper field extraction
  const media = rawMedia
    .map((m) => {
      // Handle case where m might be null/undefined
      if (!m) return null;

      // Extract URL - could be in 'url' field or 'filename' for uploaded media
      // Payload CMS may store media as relationship objects with nested data
      const url = String(m.url || m.filename || "");

      // Extract type - default to 'image' if not specified
      // Video posts should have type: 'video' set
      const type = (m.type as "image" | "video") || "image";

      // Skip media without valid URL
      if (!url) {
        console.warn("[transformPost] Media item missing URL:", m);
        return null;
      }

      return { type, url };
    })
    .filter((m): m is { type: "image" | "video"; url: string } => m !== null);

  // Log media transformation for debugging
  if (rawMedia.length > 0) {
    console.log("[transformPost] Media transform:", {
      postId: doc.id,
      rawCount: rawMedia.length,
      transformedCount: media.length,
      hasVideo: media.some((m) => m.type === "video"),
    });
  }

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
    caption: (doc.content || doc.caption) as string,
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
  // Fetch feed posts
  async getFeedPosts(): Promise<Post[]> {
    try {
      const response = await posts.find({ limit: 20, sort: "-createdAt" });
      return response.docs.map(transformPost);
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
      const page = Math.floor(cursor / PAGE_SIZE) + 1;
      const response = await posts.find({
        limit: PAGE_SIZE,
        page,
        sort: "-createdAt",
        depth: 2,
      });

      return {
        data: response.docs.map(transformPost),
        nextCursor: response.hasNextPage ? cursor + PAGE_SIZE : null,
        hasMore: response.hasNextPage,
      };
    } catch (error) {
      console.error("[postsApi] getFeedPostsPaginated error:", error);
      return { data: [], nextCursor: null, hasMore: false };
    }
  },

  // Fetch profile posts
  async getProfilePosts(userId: string): Promise<Post[]> {
    try {
      const response = await posts.find({
        limit: 50,
        sort: "-createdAt",
        where: { author: { equals: userId } },
      });
      return response.docs.map(transformPost);
    } catch (error) {
      console.error("[postsApi] getProfilePosts error:", error);
      return [];
    }
  },

  // Fetch single post by ID
  // CRITICAL: Throws on error instead of returning null
  // This allows React Query to properly distinguish loading/error/success states
  async getPostById(id: string): Promise<Post> {
    if (!id) {
      throw new Error("Post ID is required");
    }

    console.log("[postsApi] getPostById called with id:", id);

    try {
      // Use depth=3 to ensure nested media relationships are fully populated
      const doc = await posts.findByID(id, 3);

      if (!doc || !doc.id) {
        console.error(
          "[postsApi] getPostById: No document returned for id:",
          id,
        );
        throw new Error("Post not found");
      }

      // Log raw media structure for debugging video issues
      const rawMedia = (doc as Record<string, unknown>).media;
      console.log("[postsApi] getPostById raw response:", {
        id: doc.id,
        hasMedia: !!rawMedia,
        mediaType: Array.isArray(rawMedia) ? "array" : typeof rawMedia,
        mediaCount: Array.isArray(rawMedia) ? rawMedia.length : 0,
        mediaStructure:
          Array.isArray(rawMedia) && rawMedia.length > 0
            ? JSON.stringify(rawMedia[0]).slice(0, 200)
            : "empty",
      });

      const post = transformPost(doc as Record<string, unknown>);
      console.log("[postsApi] getPostById success:", {
        id: post.id,
        hasMedia: !!post.media?.length,
        mediaTypes: post.media?.map((m) => m.type),
      });
      return post;
    } catch (error: any) {
      console.error(
        "[postsApi] getPostById error for id:",
        id,
        error?.message || error,
      );

      // Re-throw with proper error message
      if (error?.status === 404) {
        throw new Error("Post not found");
      } else if (error?.status === 403) {
        throw new Error("You don't have permission to view this post");
      } else if (error?.message) {
        throw error;
      } else {
        throw new Error("Failed to load post");
      }
    }
  },

  // Like/unlike a post
  async likePost(
    postId: string,
    isLiked: boolean,
  ): Promise<{ postId: string; likes: number; liked: boolean }> {
    try {
      const action = isLiked ? "unlike" : "like";
      // CRITICAL: Use PAYLOAD URL for social actions - NOT auth server
      const { getPayloadBaseUrl } = await import("@/lib/api-config");
      const API_BASE_URL = getPayloadBaseUrl();
      const url = `${API_BASE_URL}/api/posts/${postId}/like`;

      // Get auth token and cookies
      const { getAuthToken, getAuthCookies } =
        await import("@/lib/auth-client");
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
        credentials: "omit", // Always cross-origin to Payload CMS
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
          // Look up user in Payload CMS
          try {
            const userResult = await users.find({
              where: { username: { equals: data.authorUsername } },
              limit: 1,
            });

            if (userResult.docs && userResult.docs.length > 0) {
              authorId = (userResult.docs[0] as { id: string }).id;
              userIdCache[data.authorUsername] = authorId;
              console.log("[postsApi] Found author ID:", authorId);
            } else {
              console.warn(
                "[postsApi] User not found in CMS:",
                data.authorUsername,
              );
            }
          } catch (lookupError) {
            console.error("[postsApi] User lookup error:", lookupError);
          }
        }
      }

      const doc = await posts.create({
        author: authorId, // Use the looked-up Payload CMS user ID
        content: data.caption,
        caption: data.caption,
        location: data.location,
        media: data.media || [],
        isNSFW: data.isNSFW || false,
      });
      console.log("[postsApi] createPost success:", JSON.stringify(doc));

      const newPost = transformPost(doc as Record<string, unknown>);

      // Extract mentions and send notifications
      if (data.caption && data.authorUsername) {
        const mentions = extractMentions(data.caption);
        console.log("[postsApi] Extracted mentions:", mentions);

        // Send notification to each mentioned user (except self)
        // NOTE: Mention notifications are now created server-side in Payload hooks
        // when posts are created. No client-side notification creation needed.
        if (mentions.length > 0) {
          console.log(
            "[postsApi] Post created with mentions, notifications handled server-side:",
            mentions,
          );
        }
      }

      return newPost;
    } catch (error: any) {
      console.error("[postsApi] createPost error:", error);
      console.error("[postsApi] Error message:", error?.message);
      console.error("[postsApi] Error status:", error?.status);
      throw error;
    }
  },

  // Delete a post
  async deletePost(postId: string): Promise<string> {
    try {
      await posts.delete(postId);
      return postId;
    } catch (error) {
      console.error("[postsApi] deletePost error:", error);
      throw error;
    }
  },
};
