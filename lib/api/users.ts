import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import { getCurrentUserId, getCurrentUserIdInt } from "./auth-helper";
import { updateProfilePrivileged } from "../supabase/privileged";
import { requireBetterAuthToken, getCurrentUserRow } from "../auth/identity";

export const usersApi = {
  /**
   * Get user profile by username
   */
  async getProfileByUsername(username: string) {
    try {
      if (!username) return null;

      const currentUserId = getCurrentUserIdInt();

      // Fire user fetch + follow check in parallel (no waterfall)
      const userFetch = supabase
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
        .eq(DB.users.username, username)
        .single();

      const [{ data, error }] = await Promise.all([userFetch]);

      if (data) {
        const targetUserId = data[DB.users.id];

        // Follow check fires only when we have both IDs and they differ
        let isFollowing = false;
        if (currentUserId && targetUserId && currentUserId !== targetUserId) {
          const { data: followData } = await supabase
            .from(DB.follows.table)
            .select("id")
            .eq(DB.follows.followerId, currentUserId)
            .eq(DB.follows.followingId, targetUserId)
            .maybeSingle();
          isFollowing = !!followData;
        }

        return {
          id: String(targetUserId),
          authId: data[DB.users.authId],
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
          isFollowing,
          createdAt: data[DB.users.createdAt],
        };
      }

      // Fallback: Better Auth `user` table by username (single indexed query)
      const { data: baUser } = await supabase
        .from("user")
        .select("id, name, email, image, username, createdAt")
        .eq("username", username)
        .maybeSingle();

      if (baUser) {
        const displayName = (baUser.name || "").trim();
        return {
          id: baUser.id,
          authId: baUser.id,
          username: baUser.username || username,
          email: baUser.email,
          firstName: displayName.split(" ")[0] || "",
          lastName: displayName.split(" ").slice(1).join(" ") || "",
          name: displayName || baUser.username || "New User",
          bio: "",
          location: null,
          avatar: baUser.image || "",
          verified: false,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isPrivate: false,
          isFollowing: false,
          createdAt: baUser.createdAt,
        };
      }

      return null;
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
   * Get profile by Better Auth user ID (fallback for users without app profile)
   * Queries the Better Auth `user` table directly when `users` table has no row
   */
  async getProfileByAuthUserId(authId: string) {
    try {
      if (!authId) return null;

      // First try the app `users` table via auth_id
      const { data: profile } = await supabase
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
        .eq(DB.users.authId, authId)
        .maybeSingle();

      if (profile) {
        return {
          id: String(profile[DB.users.id]),
          username: profile[DB.users.username],
          email: profile[DB.users.email],
          firstName: profile[DB.users.firstName],
          lastName: profile[DB.users.lastName],
          name: profile[DB.users.firstName] || profile[DB.users.username] || "",
          bio: profile[DB.users.bio] || "",
          location: profile[DB.users.location],
          avatar:
            (profile.avatar as any)?.url ||
            (profile.avatar as any)?.[0]?.url ||
            "",
          verified: profile[DB.users.verified] || false,
          followersCount: Number(profile[DB.users.followersCount]) || 0,
          followingCount: Number(profile[DB.users.followingCount]) || 0,
          postsCount: Number(profile[DB.users.postsCount]) || 0,
          isPrivate: profile[DB.users.isPrivate] || false,
          createdAt: profile[DB.users.createdAt],
        };
      }

      // Fallback: query Better Auth `user` table directly
      const { data: authUser, error } = await supabase
        .from("user")
        .select("id, name, email, image, username, createdAt")
        .eq("id", authId)
        .single();

      if (error || !authUser) return null;

      const displayName = (authUser.name || "").trim();
      return {
        id: authId,
        username:
          authUser.username ||
          displayName.toLowerCase().replace(/\s+/g, "_") ||
          authId,
        email: authUser.email,
        firstName: displayName.split(" ")[0] || "",
        lastName: displayName.split(" ").slice(1).join(" ") || "",
        name: displayName || "New User",
        bio: "",
        location: null,
        avatar: authUser.image || "",
        verified: false,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isPrivate: false,
        createdAt: authUser.createdAt,
      };
    } catch (error) {
      console.error("[Users] getProfileByAuthUserId error:", error);
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
    username?: string;
    bio?: string;
    location?: string;
    name?: string;
    website?: string;
    links?: string[];
    avatar?: string;
  }) {
    try {
      console.log("[Users] updateProfile via Edge Function:", updates);

      // Use Edge Function wrapper for privileged write
      const updatedUser = await updateProfilePrivileged({
        name: updates.name,
        firstName: updates.firstName,
        lastName: updates.lastName,
        username: updates.username,
        bio: updates.bio,
        location: updates.location,
        website: updates.website,
        links: updates.links,
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
   * Get liked posts for current user (Edge Function — bypasses RLS)
   */
  async getLikedPosts(): Promise<string[]> {
    try {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<{
        postIds?: string[];
        error?: string;
      }>("get-liked-posts", {
        body: {},
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("[Users] getLikedPosts Edge Function error:", error);
        return [];
      }
      if (!data?.postIds) {
        if (data?.error) console.error("[Users] get-liked-posts:", data.error);
        return [];
      }
      return data.postIds;
    } catch (error) {
      console.error("[Users] getLikedPosts error:", error);
      return [];
    }
  },

  /**
   * Get newest users (for "Discover New Profiles" section)
   * Queries Better Auth `user` table for real signups, then enriches
   * with app `users` profile data where available.
   */
  async getNewestUsers(limit: number = 15) {
    try {
      // Get current user's auth_id to exclude from results
      const currentUserRow = await getCurrentUserRow();
      const currentAuthId = currentUserRow?.authId || null;

      // Query Better Auth `user` table — this is where real signups live
      let query = supabase
        .from("user")
        .select("id, name, email, image, username, createdAt")
        .order("createdAt", { ascending: false })
        .limit(limit * 3);

      if (currentAuthId) {
        query = query.neq("id", currentAuthId);
      }

      const { data: authUsers, error } = await query;

      if (error) {
        console.error("[Users] getNewestUsers BA query error:", error);
        throw error;
      }
      if (!authUsers?.length) {
        console.log("[Users] getNewestUsers: no BA users found");
        return [];
      }

      console.log("[Users] getNewestUsers BA raw count:", authUsers.length);

      // Phase 1: Filter out test accounts by email only
      const TEST_EMAILS = ["@test.com", "@example.com", "@deviant.test"];
      const emailFiltered = authUsers.filter((u: any) => {
        const email = (u.email || "").toLowerCase();
        if (TEST_EMAILS.some((t) => email.endsWith(t))) return false;
        const name = (u.name || "").toLowerCase().trim();
        if (name.startsWith("test")) return false;
        return true;
      });

      // Enrich with app profile data (username, avatar, bio)
      const authIds = emailFiltered.map((u: any) => u.id);
      const { data: profiles } = await supabase
        .from(DB.users.table)
        .select(
          `${DB.users.authId}, ${DB.users.username}, ${DB.users.bio}, ${DB.users.verified}, avatar:${DB.users.avatarId}(url)`,
        )
        .in(DB.users.authId, authIds);

      const profileMap: Record<string, any> = {};
      for (const p of profiles || []) {
        profileMap[p[DB.users.authId]] = p;
      }

      // Phase 2: Filter out hidden accounts by BOTH name and username
      const HIDDEN_USERNAMES = ["mike_test", "applereview"];
      const filtered = emailFiltered.filter((u: any) => {
        const profile = profileMap[u.id];
        const name = (u.name || "").toLowerCase().trim();
        const username = (profile?.[DB.users.username] || "").toLowerCase();
        if (HIDDEN_USERNAMES.includes(name)) return false;
        if (HIDDEN_USERNAMES.includes(username)) return false;
        return true;
      });

      console.log("[Users] getNewestUsers filtered count:", filtered.length);

      return filtered.slice(0, limit).map((u: any) => {
        const profile = profileMap[u.id];
        const displayName = (u.name || "").trim();
        const username =
          profile?.[DB.users.username] ||
          u.username ||
          displayName.toLowerCase().replace(/\s+/g, "_");
        return {
          id: u.id,
          username,
          name: displayName || username,
          avatar: profile?.avatar?.url || u.image || "",
          verified: profile?.[DB.users.verified] || false,
          bio: profile?.[DB.users.bio] || "",
          postsCount: 0,
        };
      });
    } catch (error) {
      console.error("[Users] getNewestUsers error:", error);
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
   * Get followers for a user (Edge Function — bypasses RLS)
   */
  async getFollowers(userId: string, page: number = 1, limit: number = 20) {
    try {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<{
        docs?: any[];
        totalDocs?: number;
        hasNextPage?: boolean;
        page?: number;
        error?: string;
      }>("get-followers", {
        body: { userId, page, limit },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("[Users] getFollowers Edge Function error:", error);
        return { docs: [], totalDocs: 0, hasNextPage: false, page };
      }
      if (!data?.docs) {
        if (data?.error) console.error("[Users] get-followers:", data.error);
        return { docs: [], totalDocs: 0, hasNextPage: false, page };
      }
      return {
        docs: data.docs,
        totalDocs: data.totalDocs ?? 0,
        hasNextPage: data.hasNextPage ?? false,
        page: data.page ?? page,
      };
    } catch (error) {
      console.error("[Users] getFollowers error:", error);
      return { docs: [], totalDocs: 0, hasNextPage: false, page };
    }
  },

  /**
   * Get following for a user (Edge Function — bypasses RLS)
   */
  async getFollowing(userId: string, page: number = 1, limit: number = 20) {
    try {
      const token = await requireBetterAuthToken();
      const { data, error } = await supabase.functions.invoke<{
        docs?: any[];
        totalDocs?: number;
        hasNextPage?: boolean;
        page?: number;
        error?: string;
      }>("get-following", {
        body: { userId, page, limit },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("[Users] getFollowing Edge Function error:", error);
        return { docs: [], totalDocs: 0, hasNextPage: false, page };
      }
      if (!data?.docs) {
        if (data?.error) console.error("[Users] get-following:", data.error);
        return { docs: [], totalDocs: 0, hasNextPage: false, page };
      }
      return {
        docs: data.docs,
        totalDocs: data.totalDocs ?? 0,
        hasNextPage: data.hasNextPage ?? false,
        page: data.page ?? page,
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
      console.log("[Users] updateAvatar via Edge Function");

      const token = await requireBetterAuthToken();

      const { data: response, error } = await supabase.functions.invoke<{
        ok: boolean;
        data?: { success: boolean; avatarUrl: string };
        error?: { code: string; message: string };
      }>("update-avatar", {
        body: { avatarUrl },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message || "Failed to update avatar");
      if (!response?.ok)
        throw new Error(response?.error?.message || "Failed to update avatar");

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

  /**
   * Submit a host verification request
   */
  async submitVerificationRequest(reason?: string, socialUrl?: string) {
    try {
      const authId = await getCurrentUserId();
      if (!authId) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc(
        "submit_verification_request",
        {
          p_user_auth_id: authId,
          p_reason: reason || null,
          p_social_url: socialUrl || null,
        },
      );

      if (error) throw error;
      return data as { success: boolean; error?: string; request_id?: number };
    } catch (error) {
      console.error("[Users] submitVerificationRequest error:", error);
      return { success: false, error: "Failed to submit request" };
    }
  },

  /**
   * Get current user's verification status
   */
  async getVerificationStatus() {
    try {
      const authId = await getCurrentUserId();
      if (!authId) return null;

      const { data, error } = await supabase.rpc("get_verification_status", {
        p_user_auth_id: authId,
      });

      if (error) throw error;
      return data as {
        is_verified: boolean;
        has_pending_request: boolean;
        last_request_status: string | null;
        last_request_date: string | null;
      };
    } catch (error) {
      console.error("[Users] getVerificationStatus error:", error);
      return null;
    }
  },
};
