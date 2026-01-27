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
      const doc = await posts.findByID(id, 2);

      if (!doc || !doc.id) {
        console.error(
          "[postsApi] getPostById: No document returned for id:",
          id,
        );
        throw new Error("Post not found");
      }

      const post = transformPost(doc as Record<string, unknown>);
      console.log("[postsApi] getPostById success:", {
        id: post.id,
        hasMedia: !!post.media?.length,
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
      const API_BASE_URL =
        process.env.EXPO_PUBLIC_AUTH_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        "";
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
        for (const mentionedUsername of mentions) {
          if (
            mentionedUsername.toLowerCase() !==
            data.authorUsername.toLowerCase()
          ) {
            try {
              await notifications.create({
                type: "mention",
                recipientUsername: mentionedUsername,
                senderUsername: data.authorUsername,
                postId: newPost.id,
                content: data.caption.slice(0, 100), // First 100 chars
              });
              console.log(
                "[postsApi] Sent mention notification to:",
                mentionedUsername,
              );
            } catch (notifError) {
              // Don't fail post creation if notification fails
              console.error(
                "[postsApi] Failed to send mention notification:",
                notifError,
              );
            }
          }
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
