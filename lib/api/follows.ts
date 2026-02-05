import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserIdInt } from "./auth-helper";
import { requireBetterAuthToken } from "../auth/identity";

interface ToggleFollowResponse {
  ok: boolean;
  data?: { following: boolean };
  error?: { code: string; message: string };
}

export const followsApi = {
  /**
   * Follow/unfollow user via Edge Function
   */
  async toggleFollow(targetUserId: string, _isFollowing?: boolean) {
    try {
      console.log("[Follows] toggleFollow via Edge Function:", targetUserId);

      const token = await requireBetterAuthToken();
      const targetUserIdInt = parseInt(targetUserId);

      const { data, error } =
        await supabase.functions.invoke<ToggleFollowResponse>("toggle-follow", {
          body: { targetUserId: targetUserIdInt },
          headers: { Authorization: `Bearer ${token}` },
        });

      if (error) {
        console.error("[Follows] Edge Function error:", error);
        throw new Error(error.message || "Failed to toggle follow");
      }

      if (!data?.ok || !data?.data) {
        const errorMessage = data?.error?.message || "Failed to toggle follow";
        console.error("[Follows] Toggle failed:", errorMessage);
        throw new Error(errorMessage);
      }

      // Get updated counts
      const { data: targetUser } = await supabase
        .from(DB.users.table)
        .select(`${DB.users.followersCount}, ${DB.users.followingCount}`)
        .eq(DB.users.id, targetUserIdInt)
        .single();

      console.log("[Follows] toggleFollow result:", data.data);
      return {
        success: true,
        following: data.data.following,
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
