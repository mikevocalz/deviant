/**
 * Bootstrap Profile Hook
 *
 * When `perf_bootstrap_profile` flag is ON, fetches all profile above-the-fold
 * data in a single request and hydrates the TanStack Query cache.
 *
 * When the flag is OFF, returns early and the profile falls back to
 * individual queries (useMyProfile, useProfilePosts, etc.)
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { bootstrapApi, type BootstrapProfileResponse } from "@/lib/api/bootstrap";
import { profileKeys } from "@/lib/hooks/use-profile";
import { postKeys } from "@/lib/hooks/use-posts";
import { useScreenTrace } from "@/lib/perf/screen-trace";

function hydrateFromProfileBootstrap(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  data: BootstrapProfileResponse,
) {
  const p = data.profile;

  // 1. Seed the profile query cache
  queryClient.setQueryData(profileKeys.byId(userId), {
    id: p.id,
    username: p.username,
    name: p.firstName || p.username,
    displayName: p.firstName || p.username,
    bio: p.bio,
    avatar: p.avatarUrl || undefined,
    avatarUrl: p.avatarUrl || undefined,
    website: p.website,
    location: p.location,
    followersCount: p.followersCount,
    followingCount: p.followingCount,
    postsCount: p.postsCount,
    verified: p.verified,
    isOwnProfile: true,
  });

  // 2. Seed the profile posts query cache with grid thumbnail data
  queryClient.setQueryData(postKeys.profilePosts(userId), data.posts);

  console.log(
    `[BootstrapProfile] Hydrated cache: profile + ${data.posts.length} posts`,
  );
}

export function useBootstrapProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) || "";
  const hasRun = useRef(false);
  const trace = useScreenTrace("Profile");

  const enabled = isFeatureEnabled("perf_bootstrap_profile");

  useEffect(() => {
    if (!enabled || !userId || hasRun.current) return;
    hasRun.current = true;

    // Check if we already have fresh profile data from MMKV cache
    const existingProfile = queryClient.getQueryData(profileKeys.byId(userId));
    if (existingProfile) {
      trace.markCacheHit();
      trace.markUsable();
      return;
    }

    bootstrapApi.profile({ userId }).then((data) => {
      if (!data) return;
      hydrateFromProfileBootstrap(queryClient, userId, data);
      trace.markUsable();
    });
  }, [enabled, userId, queryClient, trace]);

  return { enabled };
}
