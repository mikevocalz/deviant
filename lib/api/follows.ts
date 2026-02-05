import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";

export const followsApi = {
  /**
   * Follow/unfollow user
   */
  async toggleFollow(targetUserId: string, isFollowing: boolean) {
    try {
      console.log(
        "[Follows] toggleFollow:",
        targetUserId,
        "isFollowing:",
        isFollowing,
      );

      const currentUserId = getCurrentUserIdInt();
      if (!currentUserId) throw new Error("Not authenticated");

      const targetUserIdInt = parseInt(targetUserId);

      if (isFollowing) {
        // Unfollow
        await supabase
          .from(DB.follows.table)
          .delete()
          .eq(DB.follows.followerId, currentUserId)
          .eq(DB.follows.followingId, targetUserIdInt);

        // Decrement counts
        await supabase.rpc("decrement_following_count", {
          user_id: currentUserId,
        });
        await supabase.rpc("decrement_followers_count", {
          user_id: targetUserIdInt,
        });
      } else {
        // Follow
        await supabase.from(DB.follows.table).insert({
          [DB.follows.followerId]: currentUserId,
          [DB.follows.followingId]: targetUserIdInt,
        });

        // Increment counts
        await supabase.rpc("increment_following_count", {
          user_id: currentUserId,
        });
        await supabase.rpc("increment_followers_count", {
          user_id: targetUserIdInt,
        });
      }

      // Get updated counts
      const { data: targetUser } = await supabase
        .from(DB.users.table)
        .select(`${DB.users.followersCount}, ${DB.users.followingCount}`)
        .eq(DB.users.id, parseInt(targetUserId))
        .single();

      return {
        success: true,
        following: !isFollowing,
        followersCount: targetUser?.[DB.users.followersCount] || 0,
        followingCount: targetUser?.[DB.users.followingCount] || 0,
      };
    } catch (error) {
      console.error("[Follows] toggleFollow error:", error);
      throw error;
    }
  },

  /**
   * Check if following user
   */
  async isFollowing(targetUserId: string): Promise<boolean> {
    try {
      const currentUserId = getCurrentUserIdInt();
      if (!currentUserId) return false;

      const { data, error } = await supabase
        .from(DB.follows.table)
        .select("id")
        .eq(DB.follows.followerId, currentUserId)
        .eq(DB.follows.followingId, parseInt(targetUserId))
        .single();

      return !!data && !error;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get followers list
   */
  async getFollowers(userId: string) {
    try {
      const { data, error } = await supabase
        .from(DB.follows.table)
        .select(
          `
          follower:${DB.follows.followerId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `,
        )
        .eq(DB.follows.followingId, parseInt(userId))
        .limit(100);

      if (error) throw error;

      return (data || []).map((f: any) => ({
        id: String(f.follower[DB.users.id]),
        username: f.follower[DB.users.username],
        avatar: f.follower.avatar?.url || "",
      }));
    } catch (error) {
      console.error("[Follows] getFollowers error:", error);
      return [];
    }
  },

  /**
   * Get following list
   */
  async getFollowing(userId: string) {
    try {
      const { data, error } = await supabase
        .from(DB.follows.table)
        .select(
          `
          following:${DB.follows.followingId}(
            ${DB.users.id},
            ${DB.users.username},
            avatar:${DB.users.avatarId}(url)
          )
        `,
        )
        .eq(DB.follows.followerId, parseInt(userId))
        .limit(100);

      if (error) throw error;

      return (data || []).map((f: any) => ({
        id: String(f.following[DB.users.id]),
        username: f.following[DB.users.username],
        avatar: f.following.avatar?.url || "",
      }));
    } catch (error) {
      console.error("[Follows] getFollowing error:", error);
      return [];
    }
  },
};
