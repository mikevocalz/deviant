/**
 * Profile Hooks
 *
 * CRITICAL: These hooks provide the canonical read path for profile data.
 * 
 * useMyProfile - Fetches current user's profile with counts
 * useUpdateProfile - Mutation to update profile with proper cache sync
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

// Query keys - MUST be scoped by userId
export const profileKeys = {
  all: ["profile"] as const,
  byId: (userId: string) => ["profile", userId] as const,
  byUsername: (username: string) => ["profile", "username", username] as const,
};

export interface ProfileData {
  id: string;
  username: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  avatarUrl?: string;
  website?: string;
  location?: string;
  hashtags?: string[];
  verified?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isOwnProfile?: boolean;
}

/**
 * useMyProfile - Fetches current user's profile with computed counts
 * 
 * CRITICAL: This is the canonical source for profile data on my profile screen.
 * Uses query key: ['profile', myUserId]
 * Fetches via: GET /api/users/:id/profile
 */
export function useMyProfile() {
  const authUser = useAuthStore((s) => s.user);
  const userId = authUser?.id;

  return useQuery({
    queryKey: profileKeys.byId(userId || ""),
    queryFn: async (): Promise<ProfileData | null> => {
      if (!userId) return null;

      console.log("[useMyProfile] Fetching profile for userId:", userId);

      try {
        const profile = await users.getProfile(userId);
        console.log("[useMyProfile] Profile response:", {
          id: profile.id,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          postsCount: profile.postsCount,
        });

        return {
          id: String(profile.id),
          username: profile.username,
          name: profile.displayName,
          displayName: profile.displayName,
          bio: profile.bio,
          avatar: profile.avatarUrl || profile.avatar,
          avatarUrl: profile.avatarUrl,
          followersCount: profile.followersCount || 0,
          followingCount: profile.followingCount || 0,
          postsCount: profile.postsCount || 0,
          verified: false,
          isOwnProfile: true,
        };
      } catch (error) {
        console.error("[useMyProfile] Error fetching profile:", error);
        // Fall back to authUser data if profile endpoint fails
        if (authUser) {
          return {
            id: authUser.id,
            username: authUser.username,
            name: authUser.name,
            bio: authUser.bio,
            avatar: authUser.avatar,
            website: authUser.website,
            location: authUser.location,
            hashtags: authUser.hashtags,
            followersCount: authUser.followersCount || 0,
            followingCount: authUser.followingCount || 0,
            postsCount: authUser.postsCount || 0,
            verified: authUser.isVerified,
            isOwnProfile: true,
          };
        }
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true,
  });
}

/**
 * useUpdateProfile - Mutation to update profile with proper cache sync
 * 
 * CRITICAL: On success, updates BOTH:
 * - ['authUser'] (Zustand store via setUser)
 * - ['profile', myUserId] (React Query cache)
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      bio?: string;
      website?: string;
      avatar?: string;
      location?: string;
      hashtags?: string[];
    }) => {
      console.log("[useUpdateProfile] Updating profile:", data);
      const result = await users.updateMe(data);
      return result;
    },
    onSuccess: (result, variables) => {
      const userId = authUser?.id;
      if (!userId || !authUser) return;

      console.log("[useUpdateProfile] Success, syncing caches");

      // 1. Update Zustand auth store (immutable)
      const updatedUser = {
        ...authUser,
        bio: variables.bio ?? authUser.bio,
        website: variables.website ?? authUser.website,
        avatar: variables.avatar ?? authUser.avatar,
        location: variables.location ?? authUser.location,
        hashtags: variables.hashtags ?? authUser.hashtags,
        name: variables.name ?? authUser.name,
      };
      setUser(updatedUser);

      // 2. Update React Query profile cache (immutable)
      queryClient.setQueryData<ProfileData>(
        profileKeys.byId(userId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            bio: variables.bio ?? old.bio,
            website: variables.website ?? old.website,
            avatar: variables.avatar ?? old.avatar,
            avatarUrl: variables.avatar ?? old.avatarUrl,
            location: variables.location ?? old.location,
            hashtags: variables.hashtags ?? old.hashtags,
            name: variables.name ?? old.name,
            displayName: variables.name ?? old.displayName,
          };
        }
      );

      // 3. Also invalidate username-based queries if username exists
      if (authUser.username) {
        queryClient.invalidateQueries({
          queryKey: profileKeys.byUsername(authUser.username),
        });
      }

      // 4. Invalidate authUser query if it exists
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (error) => {
      console.error("[useUpdateProfile] Error:", error);
      // Error is propagated to caller - DO NOT swallow
    },
  });
}
