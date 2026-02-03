import { supabase } from "../supabase/client";
import { DB } from "../supabase/db-map";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  hashtags?: string[];
  isVerified: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

export const auth = {
  /**
   * Sign in with email/password
   */
  async signIn(email: string, password: string) {
    console.log("[Supabase Auth] Signing in:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Supabase Auth] Sign in error:", error);
      throw error;
    }

    // Fetch user profile
    const profile = await this.getProfile(data.user.id);
    console.log("[Supabase Auth] Sign in successful, user ID:", data.user.id);

    return { user: data.user, session: data.session, profile };
  },

  /**
   * Sign up with email/password/username
   */
  async signUp(
    email: string,
    password: string,
    username: string,
    name?: string,
  ) {
    console.log("[Supabase Auth] Signing up:", email, username);

    // Check if username exists
    const { data: existingUser } = await supabase
      .from(DB.users.table)
      .select(DB.users.username)
      .eq(DB.users.username, username)
      .single();

    if (existingUser) {
      throw new Error("Username already taken");
    }

    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name: name || username,
        },
      },
    });

    if (error) {
      console.error("[Supabase Auth] Sign up error:", error);
      throw error;
    }

    if (!data.user) {
      throw new Error("Failed to create user");
    }

    // Create user profile in users table
    const { error: profileError } = await supabase.from(DB.users.table).insert({
      id: parseInt(data.user.id), // Assuming integer ID
      [DB.users.email]: email,
      [DB.users.username]: username,
      [DB.users.firstName]: name || username,
      [DB.users.followersCount]: 0,
      [DB.users.followingCount]: 0,
      [DB.users.postsCount]: 0,
    });

    if (profileError) {
      console.error("[Supabase Auth] Profile creation error:", profileError);
      // Try to clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    console.log("[Supabase Auth] Sign up successful, user ID:", data.user.id);
    const profile = await this.getProfile(data.user.id);

    return { user: data.user, session: data.session, profile };
  },

  /**
   * Sign out
   */
  async signOut() {
    console.log("[Supabase Auth] Signing out");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Supabase Auth] Sign out error:", error);
      throw error;
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[Supabase Auth] Get session error:", error);
      return null;
    }
    return data.session;
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("[Supabase Auth] Get user error:", error);
      return null;
    }
    return data.user;
  },

  /**
   * Get user profile from users table
   */
  async getProfile(userId: string): Promise<AppUser | null> {
    try {
      // Query by auth_id (UUID) or email
      let query = supabase.from(DB.users.table).select(`
          ${DB.users.id},
          ${DB.users.authId},
          ${DB.users.email},
          ${DB.users.username},
          ${DB.users.firstName},
          ${DB.users.lastName},
          ${DB.users.bio},
          ${DB.users.location},
          ${DB.users.verified},
          ${DB.users.followersCount},
          ${DB.users.followingCount},
          ${DB.users.postsCount},
          avatar:${DB.users.avatarId}(url)
        `);

      // Check if userId is a UUID (auth_id)
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        );

      if (isUUID) {
        // Query by auth_id
        query = query.eq(DB.users.authId, userId);
      } else if (/^\d+$/.test(userId)) {
        // Query by internal ID
        query = query.eq(DB.users.id, parseInt(userId));
      } else {
        // Try to match by email from auth
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user?.email) {
          query = query.eq(DB.users.email, authUser.user.email);
        } else {
          return null;
        }
      }

      const { data, error } = await query.single();

      if (error || !data) {
        console.error("[Supabase Auth] Get profile error:", error);
        return null;
      }

      return {
        id: String(data[DB.users.id]),
        email: data[DB.users.email],
        username: data[DB.users.username],
        name: data[DB.users.firstName] || data[DB.users.username],
        avatar: (data.avatar as any)?.url,
        bio: data[DB.users.bio],
        location: data[DB.users.location],
        isVerified: data[DB.users.verified] || false,
        postsCount: Number(data[DB.users.postsCount]) || 0,
        followersCount: Number(data[DB.users.followersCount]) || 0,
        followingCount: Number(data[DB.users.followingCount]) || 0,
        hashtags: [],
      };
    } catch (error) {
      console.error("[Supabase Auth] Get profile error:", error);
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<AppUser>) {
    const dbUpdates: any = {};

    if (updates.name) dbUpdates[DB.users.firstName] = updates.name;
    if (updates.bio !== undefined) dbUpdates[DB.users.bio] = updates.bio;
    if (updates.location !== undefined)
      dbUpdates[DB.users.location] = updates.location;

    const { data, error } = await supabase
      .from(DB.users.table)
      .update(dbUpdates)
      .eq(DB.users.id, userId)
      .select()
      .single();

    if (error) {
      console.error("[Supabase Auth] Update profile error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
