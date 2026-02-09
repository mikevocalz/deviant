/**
 * Post Tags API — Instagram-style user tagging on post images
 *
 * Tags are stored with x/y position (0-1 normalized) and media index
 * for carousel posts.
 */

import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";

export interface PostTag {
  id: number;
  postId: number;
  taggedUserId: number;
  username: string;
  avatar: string;
  xPosition: number;
  yPosition: number;
  mediaIndex: number;
}

export const postTagsApi = {
  /**
   * Add tags to a post (upsert — replaces existing tag for same user+media)
   */
  async addTags(
    postId: string,
    tags: Array<{ userId: number; x: number; y: number; mediaIndex?: number }>,
  ): Promise<PostTag[]> {
    try {
      if (!tags.length) return [];

      const rows = tags.map((t) => ({
        [DB.postTags.postId]: parseInt(postId),
        [DB.postTags.taggedUserId]: t.userId,
        [DB.postTags.xPosition]: t.x,
        [DB.postTags.yPosition]: t.y,
        [DB.postTags.mediaIndex]: t.mediaIndex ?? 0,
      }));

      const { data, error } = await supabase
        .from(DB.postTags.table)
        .upsert(rows, { onConflict: "post_id,tagged_user_id,media_index" })
        .select();

      if (error) throw error;
      console.log("[PostTags] Added", data?.length, "tags to post", postId);

      // Return with user info
      return this.getTagsForPost(postId);
    } catch (error) {
      console.error("[PostTags] addTags error:", error);
      throw error;
    }
  },

  /**
   * Get all tags for a post (with user info)
   */
  async getTagsForPost(postId: string): Promise<PostTag[]> {
    try {
      const { data, error } = await supabase
        .from(DB.postTags.table)
        .select(
          `
          ${DB.postTags.id},
          ${DB.postTags.postId},
          ${DB.postTags.taggedUserId},
          ${DB.postTags.xPosition},
          ${DB.postTags.yPosition},
          ${DB.postTags.mediaIndex},
          user:${DB.postTags.taggedUserId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `,
        )
        .eq(DB.postTags.postId, parseInt(postId));

      if (error) throw error;

      return (data || []).map((tag: any) => ({
        id: tag[DB.postTags.id],
        postId: tag[DB.postTags.postId],
        taggedUserId: tag[DB.postTags.taggedUserId],
        username: tag.user?.[DB.users.username] || "unknown",
        avatar: tag.user?.avatar?.url || "",
        xPosition: tag[DB.postTags.xPosition] || 0.5,
        yPosition: tag[DB.postTags.yPosition] || 0.5,
        mediaIndex: tag[DB.postTags.mediaIndex] || 0,
      }));
    } catch (error) {
      console.error("[PostTags] getTagsForPost error:", error);
      return [];
    }
  },

  /**
   * Remove a specific tag from a post
   */
  async removeTag(postId: string, taggedUserId: number, mediaIndex: number = 0): Promise<void> {
    try {
      const { error } = await supabase
        .from(DB.postTags.table)
        .delete()
        .eq(DB.postTags.postId, parseInt(postId))
        .eq(DB.postTags.taggedUserId, taggedUserId)
        .eq(DB.postTags.mediaIndex, mediaIndex);

      if (error) throw error;
      console.log("[PostTags] Removed tag for user", taggedUserId, "from post", postId);
    } catch (error) {
      console.error("[PostTags] removeTag error:", error);
      throw error;
    }
  },

  /**
   * Replace all tags for a specific media index in a post
   */
  async setTagsForMedia(
    postId: string,
    mediaIndex: number,
    tags: Array<{ userId: number; x: number; y: number }>,
  ): Promise<PostTag[]> {
    try {
      // Delete existing tags for this media index
      await supabase
        .from(DB.postTags.table)
        .delete()
        .eq(DB.postTags.postId, parseInt(postId))
        .eq(DB.postTags.mediaIndex, mediaIndex);

      if (tags.length === 0) return this.getTagsForPost(postId);

      // Insert new tags
      return this.addTags(
        postId,
        tags.map((t) => ({ ...t, mediaIndex })),
      );
    } catch (error) {
      console.error("[PostTags] setTagsForMedia error:", error);
      throw error;
    }
  },

  /**
   * Search users for tagging (autocomplete)
   */
  async searchUsers(query: string, limit: number = 10) {
    try {
      if (!query || query.length < 1) return [];

      const { data, error } = await supabase
        .from(DB.users.table)
        .select(
          `${DB.users.id}, ${DB.users.username}, avatar:${DB.users.avatarId}(url)`,
        )
        .ilike(DB.users.username, `%${query}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map((u: any) => ({
        id: u[DB.users.id],
        username: u[DB.users.username],
        avatar: u.avatar?.url || "",
      }));
    } catch (error) {
      console.error("[PostTags] searchUsers error:", error);
      return [];
    }
  },
};
