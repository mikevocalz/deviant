import { posts } from "@/lib/api-client";
import type { Post } from "@/lib/types";

const PAGE_SIZE = 10;

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
  async getPostById(id: string): Promise<Post | null> {
    try {
      const doc = await posts.findByID(id, 2);
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
  ): Promise<{ postId: string; likes: number }> {
    try {
      const post = await posts.findByID(postId);
      const currentLikes =
        ((post as Record<string, unknown>).likes as number) || 0;
      const newLikes = isLiked
        ? Math.max(0, currentLikes - 1)
        : currentLikes + 1;
      await posts.update(postId, { likes: newLikes });
      return { postId, likes: newLikes };
    } catch (error) {
      console.error("[postsApi] likePost error:", error);
      return { postId, likes: 0 };
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
      const doc = await posts.create({
        author: data.author,
        authorUsername: data.authorUsername, // Send username for lookup
        content: data.caption,
        caption: data.caption,
        location: data.location,
        media: data.media || [],
        isNSFW: data.isNSFW || false,
      });
      console.log("[postsApi] createPost success:", JSON.stringify(doc));
      return transformPost(doc as Record<string, unknown>);
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
