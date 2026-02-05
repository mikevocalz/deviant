import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId, getCurrentUserIdInt } from "./auth-helper";
import { updateProfilePrivileged } from "../supabase/privileged";

export const usersApi = {
  /**
   * Get user profile by username
   */
  async getProfileByUsername(username: string) {
    try {
      console.log("[Users] getProfileByUsername:", username);

      if (!username) return null;

      const { data, error } = await supabase
        .from(DB.users.table)
        .select(
          `
          ${DB.users.id},
          ${DB.users.username},
          ${DB.users.email},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.location},
          ${DB.users.verified},
          ${DB.users.followersCount},
          ${DB.users.followingCount},
          ${DB.users.postsCount},
          ${DB.users.isPrivate},
          ${DB.users.createdAt},
          avatar:${DB.users.avatarId}(url)
        `,
        )
        .eq(DB.users.username, username)
        .single();

      if (error) {
        console.error("[Users] getProfileByUsername error:", error);
        return null;
      }

      return {
        id: String(data[DB.users.id]),
        username: data[DB.users.username],
        email: data[DB.users.email],
        firstName: data[DB.users.firstName],
        lastName: data[DB.users.lastName],
        name: data[DB.users.firstName] || data[DB.users.username],
        bio: data[DB.users.bio] || "",
        location: data[DB.users.location],
        avatar:
          (data.avatar as any)?.url || (data.avatar as any)?.[0]?.url || "",
        verified: data[DB.users.verified] || false,
        followersCount: Number(data[DB.users.followersCount]) || 0,
        followingCount: Number(data[DB.users.followingCount]) || 0,
        postsCount: Number(data[DB.users.postsCount]) || 0,
        isPrivate: data[DB.users.isPrivate] || false,
        createdAt: data[DB.users.createdAt],
      };
    } catch (error) {
      console.error("[Users] getProfileByUsername error:", error);
      return null;
    }
  },

  /**
   * Get user profile by ID (supports both integer ID and UUID auth_id)
   */
  async getProfileById(userId: string) {
    try {
      console.log("[Users] getProfileById:", userId);

      if (!userId) return null;

      // Determine if userId is a UUID (auth_id) or integer (id)
      const isUuid = userId.includes("-") && userId.length > 30;

      const { data, error } = await supabase
        .from(DB.users.table)
        .select(
          `
          ${DB.users.id},
          ${DB.users.authId},
          ${DB.users.username},
          ${DB.users.email},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.location},
          ${DB.users.verified},
          ${DB.users.followersCount},
          ${DB.users.followingCount},
          ${DB.users.postsCount},
          ${DB.users.isPrivate},
          ${DB.users.createdAt},
          avatar:${DB.users.avatarId}(url)
        `,
        )
        .eq(
          isUuid ? DB.users.authId : DB.users.id,
          isUuid ? userId : parseInt(userId),
        )
        .single();

      if (error) {
        console.error("[Users] getProfileById error:", error);
        return null;
      }

      return {
        id: String(data[DB.users.id]),
        username: data[DB.users.username],
        email: data[DB.users.email],
        firstName: data[DB.users.firstName],
        lastName: data[DB.users.lastName],
        name: data[DB.users.firstName] || data[DB.users.username],
        bio: data[DB.users.bio] || "",
        location: data[DB.users.location],
        avatar:
          (data.avatar as any)?.url || (data.avatar as any)?.[0]?.url || "",
        verified: data[DB.users.verified] || false,
        followersCount: Number(data[DB.users.followersCount]) || 0,
        followingCount: Number(data[DB.users.followingCount]) || 0,
        postsCount: Number(data[DB.users.postsCount]) || 0,
        isPrivate: data[DB.users.isPrivate] || false,
        createdAt: data[DB.users.createdAt],
      };
    } catch (error) {
      console.error("[Users] getProfileById error:", error);
      return null;
    }
  },

  /**
   * Update current user's profile via Edge Function
   * Uses privileged wrapper to bypass RLS securely
   */
  async updateProfile(updates: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    location?: string;
    name?: string;
    website?: string;
    avatar?: string;
  }) {
    try {
      console.log("[Users] updateProfile via Edge Function:", updates);

      // Use Edge Function wrapper for privileged write
      const updatedUser = await updateProfilePrivileged({
        name: updates.name,
        firstName: updates.firstName,
        lastName: updates.lastName,
        bio: updates.bio,
        location: updates.location,
        avatarUrl: updates.avatar,
      });

      console.log("[Users] updateProfile success:", updatedUser);
      return updatedUser;
    } catch (error) {
      console.error("[Users] updateProfile error:", error);
      throw error;
    }
  },

  /**
   * Get liked posts for current user
   */
  async getLikedPosts(): Promise<string[]> {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) return [];

      const { data, error } = await supabase
        .from(DB.likes.table)
        .select(DB.likes.postId)
        .eq(DB.likes.userId, userId);

      if (error) throw error;

      return (data || []).map((like: any) => String(like[DB.likes.postId]));
    } catch (error) {
      console.error("[Users] getLikedPosts error:", error);
      return [];
    }
  },

  /**
   * Search users by query
   */
  async searchUsers(query: string, limit: number = 20) {
    try {
      if (!query || query.length < 1) return { docs: [], totalDocs: 0 };

      const { data, error, count } = await supabase
        .from(DB.users.table)
        .select(
          `
          ${DB.users.id},
          ${DB.users.username},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.verified},
          avatar:${DB.users.avatarId}(url)
        `,
          { count: "exact" },
        )
        .or(
          `${DB.users.username}.ilike.%${query}%,${DB.users.firstName}.ilike.%${query}%`,
        )
        .limit(limit);

      if (error) throw error;

      const docs = (data || []).map((user: any) => ({
        id: String(user[DB.users.id]),
        username: user[DB.users.username] || "unknown",
        name: user[DB.users.firstName] || user[DB.users.username] || "Unknown",
        firstName: user[DB.users.firstName],
        lastName: user[DB.users.lastName],
        avatar: user.avatar?.url || "",
        bio: user[DB.users.bio] || "",
        verified: user[DB.users.verified] || false,
      }));

      return { docs, totalDocs: count || 0 };
    } catch (error) {
      console.error("[Users] searchUsers error:", error);
      return { docs: [], totalDocs: 0 };
    }
  },

  /**
   * Get followers for a user (includes isFollowing state for current viewer)
   */
  async getFollowers(userId: string, page: number = 1, limit: number = 20) {
    try {
      const offset = (page - 1) * limit;
      const currentUserId = getCurrentUserIdInt();

      const { data, error, count } = await supabase
        .from(DB.follows.table)
        .select(
          `
          follower:${DB.follows.followerId}(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          )
        `,
          { count: "exact" },
        )
        .eq(DB.follows.followingId, userId)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get IDs of users the current viewer is following
      let followingIds: number[] = [];
      if (currentUserId) {
        const { data: followingData } = await supabase
          .from(DB.follows.table)
          .select(DB.follows.followingId)
          .eq(DB.follows.followerId, currentUserId);

        followingIds = (followingData || []).map(
          (f: any) => f[DB.follows.followingId],
        );
      }

      const docs = (data || []).map((f: any) => {
        const followerId = f.follower?.[DB.users.id];
        return {
          id: String(followerId),
          username: f.follower?.[DB.users.username] || "unknown",
          name:
            f.follower?.[DB.users.firstName] ||
            f.follower?.[DB.users.username] ||
            "Unknown",
          avatar: f.follower?.avatar?.url || "",
          verified: f.follower?.[DB.users.verified] || false,
          isFollowing: followingIds.includes(followerId),
        };
      });

      return {
        docs,
        totalDocs: count || 0,
        hasNextPage: offset + limit < (count || 0),
        page,
      };
    } catch (error) {
      console.error("[Users] getFollowers error:", error);
      return { docs: [], totalDocs: 0, hasNextPage: false, page };
    }
  },

  /**
   * Get following for a user (includes isFollowing state for current viewer)
   */
  async getFollowing(userId: string, page: number = 1, limit: number = 20) {
    try {
      const offset = (page - 1) * limit;
      const currentUserId = getCurrentUserIdInt();

      const { data, error, count } = await supabase
        .from(DB.follows.table)
        .select(
          `
          following:${DB.follows.followingId}(
            ${DB.users.id},
            ${DB.users.username},
            ${DB.users.firstName},
            ${DB.users.verified},
            avatar:${DB.users.avatarId}(url)
          )
        `,
          { count: "exact" },
        )
        .eq(DB.follows.followerId, userId)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get IDs of users the current viewer is following
      let viewerFollowingIds: number[] = [];
      if (currentUserId) {
        const { data: followingData } = await supabase
          .from(DB.follows.table)
          .select(DB.follows.followingId)
          .eq(DB.follows.followerId, currentUserId);

        viewerFollowingIds = (followingData || []).map(
          (f: any) => f[DB.follows.followingId],
        );
      }

      const docs = (data || []).map((f: any) => {
        const followingId = f.following?.[DB.users.id];
        return {
          id: String(followingId),
          username: f.following?.[DB.users.username] || "unknown",
          name:
            f.following?.[DB.users.firstName] ||
            f.following?.[DB.users.username] ||
            "Unknown",
          avatar: f.following?.avatar?.url || "",
          verified: f.following?.[DB.users.verified] || false,
          isFollowing: viewerFollowingIds.includes(followingId),
        };
      });

      return {
        docs,
        totalDocs: count || 0,
        hasNextPage: offset + limit < (count || 0),
        page,
      };
    } catch (error) {
      console.error("[Users] getFollowing error:", error);
      return { docs: [], totalDocs: 0, hasNextPage: false, page };
    }
  },

  /**
   * Update avatar
   */
  async updateAvatar(avatarUrl: string) {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) throw new Error("Not authenticated");

      console.log("[Users] updateAvatar for userId:", userId);

      // First create media record
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .insert({ url: avatarUrl })
        .select("id")
        .single();

      if (mediaError) throw mediaError;

      // Then update user avatar
      const { error } = await supabase
        .from(DB.users.table)
        .update({ [DB.users.avatarId]: mediaData.id })
        .eq(DB.users.id, userId);

      if (error) throw error;
      return { success: true, avatarUrl };
    } catch (error) {
      console.error("[Users] updateAvatar error:", error);
      throw error;
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const userId = getCurrentUserIdInt();
      if (!userId) return null;

      const { data, error } = await supabase
        .from(DB.users.table)
        .select(
          `
          ${DB.users.id},
          ${DB.users.username},
          ${DB.users.email},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.verified},
          avatar:${DB.users.avatarId}(url)
        `,
        )
        .eq(DB.users.id, userId)
        .single();

      if (error) return null;

      return {
        id: String(data[DB.users.id]),
        username: data[DB.users.username],
        email: data[DB.users.email],
        firstName: data[DB.users.firstName],
        lastName: data[DB.users.lastName],
        name: data[DB.users.firstName] || data[DB.users.username],
        bio: data[DB.users.bio] || "",
        avatar:
          (data.avatar as any)?.url || (data.avatar as any)?.[0]?.url || "",
        verified: data[DB.users.verified] || false,
      };
    } catch (error) {
      console.error("[Users] getCurrentUser error:", error);
      return null;
    }
  },
};
