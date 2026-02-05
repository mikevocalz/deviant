import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import type { Post } from "@/lib/types";
import { getCurrentUserId } from "./auth-helper";

const PAGE_SIZE = 10;

/**
 * Transform database post to app Post type
 */
function transformPost(dbPost: any): Post {
  const author = dbPost.author || {};
  const media = (dbPost.media || []).map((m: any) => ({
    type: m[DB.postsMedia.type] || "image",
    url: m[DB.postsMedia.url] || "",
  }));

  // Get first media for thumbnail
  const firstMedia = media[0];
  const thumbnail = firstMedia?.url || "";
  const type = firstMedia?.type || "image";
  const hasMultipleImages = media.length > 1;

  return {
    id: String(dbPost[DB.posts.id]),
    author: {
      username: author[DB.users.username] || "unknown",
      avatar: author.avatar?.url || "",
      verified: author[DB.users.verified] || false,
      name:
        author[DB.users.firstName] || author[DB.users.username] || "Unknown",
    },
    media,
    caption: dbPost[DB.posts.content] || "",
    likes: Number(dbPost[DB.posts.likesCount]) || 0,
    comments: [],
    timeAgo: formatTimeAgo(dbPost[DB.posts.createdAt]),
    location: dbPost[DB.posts.location],
    isNSFW: dbPost[DB.posts.isNsfw] || false,
    thumbnail,
    type,
    hasMultipleImages,
  };
}

function formatTimeAgo(dateString: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

export const postsApi = {
  /**
   * Get feed posts (non-paginated, for backwards compatibility)
   */
  async getFeedPosts(): Promise<Post[]> {
    const result = await this.getFeedPostsPaginated(0);
    return result.data;
  },

  /**
   * Get feed posts (paginated)
   */
  async getFeedPostsPaginated(cursor: number = 0) {
    try {
      console.log("[Posts] getFeedPostsPaginated, cursor:", cursor);

      const {
        data: posts,
        error,
        count,
      } = await supabase
        .from(DB.posts.table)
        .select(
          `
          *,
          author:users!posts_author_id_users_id_fk(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          ),
          media:posts_media(
            ${DB.postsMedia.type},
            ${DB.postsMedia.url},
            ${DB.postsMedia.order}
          )
        `,
          { count: "exact" },
        )
        .eq(DB.posts.visibility, "public")
        .order(DB.posts.createdAt, { ascending: false })
        .range(cursor, cursor + PAGE_SIZE - 1);

      if (error) {
        console.error("[Posts] getFeedPostsPaginated error:", error);
        throw error;
      }

      const transformed = (posts || []).map(transformPost);
      const hasMore = (count || 0) > cursor + PAGE_SIZE;
      const nextCursor = hasMore ? cursor + PAGE_SIZE : null;

      console.log(
        "[Posts] getFeedPostsPaginated success, count:",
        transformed.length,
      );

      return {
        data: transformed,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      console.error("[Posts] getFeedPostsPaginated error:", error);
      return { data: [], nextCursor: null, hasMore: false };
    }
  },

  /**
   * Get single post by ID
   */
  async getPostById(id: string): Promise<Post | null> {
    try {
      console.log("[Posts] getPostById:", id);

      const { data, error } = await supabase
        .from(DB.posts.table)
        .select(
          `
          *,
          author:${DB.posts.authorId}(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          ),
          media:posts_media(
            ${DB.postsMedia.type},
            ${DB.postsMedia.url},
            ${DB.postsMedia.order}
          )
        `,
        )
        .eq(DB.posts.id, id)
        .single();

      if (error) {
        console.error("[Posts] getPostById error:", error);
        return null;
      }

      return transformPost(data);
    } catch (error) {
      console.error("[Posts] getPostById error:", error);
      return null;
    }
  },

  /**
   * Get user's posts
   * @param userId - Can be auth_id (UUID), internal id (integer), or username
   */
  async getProfilePosts(userId: string): Promise<Post[]> {
    try {
      console.log("[Posts] getProfilePosts, userId:", userId);

      // Determine the type of userId and get internal user ID
      let internalUserId = userId;
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        );
      const isInteger = /^\d+$/.test(userId);

      if (isUUID) {
        // It's a UUID (auth_id)
        const { data: userData } = await supabase
          .from(DB.users.table)
          .select(DB.users.id)
          .eq(DB.users.authId, userId)
          .single();

        if (!userData) {
          console.log("[Posts] User not found for auth_id:", userId);
          return [];
        }
        internalUserId = String(userData[DB.users.id]);
      } else if (!isInteger) {
        // It's a username
        const { data: userData } = await supabase
          .from(DB.users.table)
          .select(DB.users.id)
          .eq(DB.users.username, userId)
          .single();

        if (!userData) {
          console.log("[Posts] User not found for username:", userId);
          return [];
        }
        internalUserId = String(userData[DB.users.id]);
      }

      const { data, error } = await supabase
        .from(DB.posts.table)
        .select(
          `
          *,
          author:${DB.posts.authorId}(
            ${DB.users.id},
            ${DB.users.authId},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          ),
          media:posts_media(
            ${DB.postsMedia.type},
            ${DB.postsMedia.url},
            ${DB.postsMedia.order}
          )
        `,
        )
        .eq(DB.posts.authorId, internalUserId)
        .order(DB.posts.createdAt, { ascending: false })
        .limit(50);

      if (error) {
        console.error("[Posts] getProfilePosts error:", error);
        return [];
      }

      return (data || []).map(transformPost);
    } catch (error) {
      console.error("[Posts] getProfilePosts error:", error);
      return [];
    }
  },

  /**
   * Create new post
   */
  async createPost(data: {
    content?: string;
    media?: Array<{ type: "image" | "video"; url: string }>;
    location?: string;
    isNSFW?: boolean;
  }) {
    try {
      console.log("[Posts] createPost");

      // Get current user from Better Auth store
      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      console.log("[Posts] createPost for userId:", userId);

      // Insert post
      const { data: post, error } = await supabase
        .from(DB.posts.table)
        .insert({
          [DB.posts.authorId]: parseInt(userId),
          [DB.posts.content]: data.content || "",
          [DB.posts.location]: data.location,
          [DB.posts.isNsfw]: data.isNSFW || false,
          [DB.posts.visibility]: "public",
          [DB.posts.likesCount]: 0,
          [DB.posts.commentsCount]: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert media if provided
      if (data.media && data.media.length > 0) {
        const mediaInserts = data.media.map((m, index) => ({
          [DB.postsMedia.parentId]: post[DB.posts.id],
          [DB.postsMedia.type]: m.type,
          [DB.postsMedia.url]: m.url,
          [DB.postsMedia.order]: index,
          [DB.postsMedia.id]: `${post[DB.posts.id]}_${index}`,
        }));

        await supabase.from(DB.postsMedia.table).insert(mediaInserts);
      }

      // Increment user posts count
      await supabase.rpc("increment_posts_count", {
        user_id: parseInt(userId),
      });

      console.log("[Posts] createPost success, ID:", post[DB.posts.id]);

      // Return the created post directly instead of fetching again
      // This enables optimistic updates - the post is immediately available
      return {
        id: String(post[DB.posts.id]),
        author: {
          username: "you", // Will be updated on next fetch
          avatar: "",
          verified: false,
          name: "You",
        },
        media: data.media || [],
        caption: data.content || "",
        likes: 0,
        comments: [],
        timeAgo: "Just now",
        location: data.location,
        isNSFW: data.isNSFW || false,
        thumbnail: data.media?.[0]?.url || "",
        type: data.media?.[0]?.type || "image",
        hasMultipleImages: (data.media?.length || 0) > 1,
      };
    } catch (error) {
      console.error("[Posts] createPost error:", error);
      throw error;
    }
  },

  /**
   * Like/unlike post
   */
  async likePost(
    postId: string,
    isLiked: boolean,
  ): Promise<{ liked: boolean; likes: number }> {
    try {
      console.log("[Posts] likePost:", postId, "isLiked:", isLiked);

      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      const newLikedState = !isLiked;

      if (newLikedState) {
        // Add like
        await supabase.from(DB.likes.table).insert({
          [DB.likes.userId]: parseInt(userId),
          [DB.likes.postId]: parseInt(postId),
        });

        // Increment count
        await supabase.rpc("increment_post_likes", {
          post_id: parseInt(postId),
        });
      } else {
        // Remove like
        await supabase
          .from(DB.likes.table)
          .delete()
          .eq(DB.likes.userId, parseInt(userId))
          .eq(DB.likes.postId, parseInt(postId));

        // Decrement count
        await supabase.rpc("decrement_post_likes", {
          post_id: parseInt(postId),
        });
      }

      // Get updated likes count
      const { data: postData } = await supabase
        .from(DB.posts.table)
        .select(DB.posts.likesCount)
        .eq(DB.posts.id, postId)
        .single();

      return {
        liked: newLikedState,
        likes: postData?.[DB.posts.likesCount] || 0,
      };
    } catch (error) {
      console.error("[Posts] likePost error:", error);
      throw error;
    }
  },

  /**
   * Update post (only owner can update)
   */
  async updatePost(
    postId: string,
    updates: { content?: string; location?: string },
  ) {
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from(DB.posts.table)
        .update({
          ...(updates.content !== undefined && {
            [DB.posts.content]: updates.content,
          }),
          ...(updates.location !== undefined && {
            [DB.posts.location]: updates.location,
          }),
          [DB.posts.updatedAt]: new Date().toISOString(),
        })
        .eq(DB.posts.id, postId)
        .eq(DB.posts.authorId, parseInt(userId))
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[Posts] updatePost error:", error);
      throw error;
    }
  },

  /**
   * Delete post (only owner can delete)
   */
  async deletePost(postId: string) {
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      // Delete media first
      await supabase
        .from(DB.postsMedia.table)
        .delete()
        .eq(DB.postsMedia.parentId, postId);

      // Delete post (only if user owns it)
      const { error } = await supabase
        .from(DB.posts.table)
        .delete()
        .eq(DB.posts.id, postId)
        .eq(DB.posts.authorId, parseInt(userId));

      if (error) throw error;

      // Decrement user posts count
      await supabase.rpc("decrement_posts_count", {
        user_id: parseInt(userId),
      });

      return { success: true };
    } catch (error) {
      console.error("[Posts] deletePost error:", error);
      throw error;
    }
  },
};
