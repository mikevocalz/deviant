/**
 * Profile Hooks
 *
 * CRITICAL: These hooks provide the canonical read path for profile data.
 *
 * useMyProfile - Fetches current user's profile with counts
 * useUpdateProfile - Mutation to update profile with proper cache sync
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";
import { postKeys } from "@/lib/hooks/use-posts";
import { resolveAvatarUrl } from "@/lib/media/resolveAvatarUrl";

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
    // CRITICAL: Use empty string fallback to prevent undefined key
    // The enabled flag below ensures we only fetch when userId exists
    queryKey: profileKeys.byId(userId || "__no_user__"),
    queryFn: async (): Promise<ProfileData | null> => {
      if (!userId) {
        console.log("[useMyProfile] No userId, returning null");
        return null;
      }

      console.log("[useMyProfile] Fetching profile for userId:", userId);

      try {
        const profile = await usersApi.getProfileById(userId);
        if (!profile) {
          throw new Error("Profile not found");
        }

        // CRITICAL: Resolve avatar URL properly - it may be string or media object
        const resolvedAvatar =
          resolveAvatarUrl((profile as any).avatarUrl, "useMyProfile") ||
          resolveAvatarUrl(profile.avatar, "useMyProfile");

        // CRITICAL: Always log profile counts for debugging SEV-0
        console.log("[useMyProfile] Profile response:", {
          id: profile.id,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          postsCount: profile.postsCount,
          avatarUrlType: typeof (profile as any).avatarUrl,
          avatarType: typeof profile.avatar,
          resolvedAvatar: resolvedAvatar?.slice(0, 50),
        });

        return {
          id: String(profile.id),
          username: profile.username,
          name: profile.name || profile.username,
          displayName: profile.name || profile.username,
          bio: profile.bio,
          avatar: resolvedAvatar || undefined,
          avatarUrl: resolvedAvatar || undefined,
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
 * useUpdateProfile - Mutation to update profile with OPTIMISTIC updates
 *
 * CRITICAL: Updates happen IMMEDIATELY in onMutate, before server responds.
 * On error, we rollback to previous state.
 * Updates BOTH:
 * - ['authUser'] (Zustand store via setUser)
 * - ['profile', myUserId] (React Query cache)
 * - Feed caches (for avatar updates)
 * - Stories cache (for avatar updates)
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
      const result = await usersApi.updateProfile(data);
      return result;
    },
    onMutate: async (variables) => {
      const userId = authUser?.id;
      if (!userId || !authUser) return {};

      console.log("[useUpdateProfile] Optimistic update starting");

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: profileKeys.byId(userId) });
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      await queryClient.cancelQueries({ queryKey: ["stories"] });

      // Snapshot previous state for rollback
      const previousAuthUser = { ...authUser };
      const previousProfile = queryClient.getQueryData<ProfileData>(
        profileKeys.byId(userId),
      );
      const previousFeed = queryClient.getQueryData(["posts", "feed"]);
      const previousInfiniteFeed = queryClient.getQueryData([
        "posts",
        "feed",
        "infinite",
      ]);
      const previousProfilePosts = queryClient.getQueryData(
        postKeys.profilePosts(userId),
      );
      const previousStories = queryClient.getQueryData(["stories"]);

      // 1. OPTIMISTIC: Update Zustand auth store immediately
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

      // 2. OPTIMISTIC: Update React Query profile cache
      queryClient.setQueryData<ProfileData>(profileKeys.byId(userId), (old) => {
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
      });

      // 3. OPTIMISTIC: If avatar was updated, sync across ALL caches immediately
      if (variables.avatar) {
        console.log(
          "[useUpdateProfile] Avatar changed, optimistic sync to all caches",
        );

        // Update regular feed cache
        queryClient.setQueryData(["posts", "feed"], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((post: any) => {
            if (
              String(post.author?.id) === String(userId) ||
              post.author?.username === authUser.username
            ) {
              return {
                ...post,
                author: { ...post.author, avatar: variables.avatar },
              };
            }
            return post;
          });
        });

        // Update infinite feed cache
        queryClient.setQueryData(["posts", "feed", "infinite"], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data?.map((post: any) => {
                if (
                  String(post.author?.id) === String(userId) ||
                  post.author?.username === authUser.username
                ) {
                  return {
                    ...post,
                    author: { ...post.author, avatar: variables.avatar },
                  };
                }
                return post;
              }),
            })),
          };
        });

        // Update profile posts cache
        queryClient.setQueryData(postKeys.profilePosts(userId), (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((post: any) => ({
            ...post,
            author: { ...post.author, avatar: variables.avatar },
          }));
        });

        // Update stories cache for MY stories
        queryClient.setQueryData(["stories"], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((story: any) => {
            if (
              String(story.userId) === String(userId) ||
              story.username === authUser.username
            ) {
              return { ...story, avatar: variables.avatar };
            }
            return story;
          });
        });

        // Update stories list cache
        queryClient.setQueryData(["stories", "list"], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((story: any) => {
            if (
              String(story.userId) === String(userId) ||
              story.username === authUser.username
            ) {
              return { ...story, avatar: variables.avatar };
            }
            return story;
          });
        });

        console.log(
          "[useUpdateProfile] Avatar optimistically synced to all caches",
        );
      }

      return {
        previousAuthUser,
        previousProfile,
        previousFeed,
        previousInfiniteFeed,
        previousProfilePosts,
        previousStories,
        userId,
      };
    },
    onError: (error, variables, context) => {
      console.error("[useUpdateProfile] Error, rolling back:", error);

      // Rollback all caches on error
      if (context?.previousAuthUser) {
        setUser(context.previousAuthUser);
      }
      if (context?.userId && context?.previousProfile) {
        queryClient.setQueryData(
          profileKeys.byId(context.userId),
          context.previousProfile,
        );
      }
      if (context?.previousFeed) {
        queryClient.setQueryData(["posts", "feed"], context.previousFeed);
      }
      if (context?.previousInfiniteFeed) {
        queryClient.setQueryData(
          ["posts", "feed", "infinite"],
          context.previousInfiniteFeed,
        );
      }
      if (context?.userId && context?.previousProfilePosts) {
        queryClient.setQueryData(
          postKeys.profilePosts(context.userId),
          context.previousProfilePosts,
        );
      }
      if (context?.previousStories) {
        queryClient.setQueryData(["stories"], context.previousStories);
        queryClient.setQueryData(["stories", "list"], context.previousStories);
      }
    },
    onSuccess: (_result, variables) => {
      const userId = authUser?.id;
      if (!userId) return;

      console.log("[useUpdateProfile] Server confirmed, update complete");

      // Invalidate username-based queries if username exists (for other users viewing our profile)
      if (authUser?.username) {
        queryClient.invalidateQueries({
          queryKey: profileKeys.byUsername(authUser.username),
        });
      }
    },
  });
}
