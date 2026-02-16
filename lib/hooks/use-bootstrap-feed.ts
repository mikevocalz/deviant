/**
 * Bootstrap Feed Hook
 *
 * When `perf_bootstrap_feed` flag is ON, fetches all feed above-the-fold
 * data in a single request and hydrates the TanStack Query cache.
 *
 * When the flag is OFF, returns null and the feed falls back to
 * individual queries (useInfiniteFeedPosts, useSyncLikedPosts, etc.)
 *
 * Cache hydration strategy:
 * 1. Call bootstrap-feed edge function (1 request)
 * 2. Seed the infinite feed query cache with posts
 * 3. Seed the unread counts cache with viewer context
 * 4. Seed like state cache per post
 * 5. Return stories data for the StoriesBar
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { bootstrapApi, type BootstrapFeedResponse } from "@/lib/api/bootstrap";
import { postKeys } from "@/lib/hooks/use-posts";
import { messageKeys } from "@/lib/hooks/use-messages";
import { seedLikeState } from "@/lib/hooks/usePostLikeState";
import { useScreenTrace } from "@/lib/perf/screen-trace";

/**
 * Hydrate TanStack Query cache from bootstrap response.
 * This replaces 5+ individual queries with cache writes from a single response.
 */
function hydrateFromBootstrap(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  data: BootstrapFeedResponse,
) {
  // 1. Seed the infinite feed query cache
  // Transform bootstrap posts to match the existing feed page format
  const feedPage = {
    data: data.posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt,
      isNSFW: p.isNSFW,
      location: p.location,
      likes: p.likes,
      commentsCount: p.commentsCount,
      viewerHasLiked: p.viewerHasLiked,
      author: {
        id: p.author.id,
        username: p.author.username,
        avatar: p.author.avatar,
        verified: p.author.verified,
      },
      media: p.media,
      timeAgo: "", // Computed client-side from createdAt
    })),
    nextCursor: data.nextCursor,
    hasMore: data.hasMore,
  };

  queryClient.setQueryData(postKeys.feedInfinite(), {
    pages: [feedPage],
    pageParams: [0],
  });

  // 2. Seed unread counts
  if (data.viewer) {
    queryClient.setQueryData(messageKeys.unreadCount(userId), {
      inbox: data.viewer.unreadMessages,
      spam: 0,
    });
  }

  // 3. Seed like state per post
  data.posts.forEach((post) => {
    seedLikeState(queryClient, userId, post.id, post.viewerHasLiked, post.likes);
  });

  console.log(
    `[BootstrapFeed] Hydrated cache: ${data.posts.length} posts, ` +
      `${data.stories.length} stories, ` +
      `unread=${data.viewer.unreadMessages}`,
  );
}

/**
 * Hook: use bootstrap feed if the feature flag is enabled.
 *
 * Returns the stories data from bootstrap (since stories aren't in TanStack cache),
 * or null if bootstrap is disabled/failed.
 */
export function useBootstrapFeed() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) || "";
  const hasRun = useRef(false);
  const trace = useScreenTrace("Feed");

  const enabled = isFeatureEnabled("perf_bootstrap_feed");

  useEffect(() => {
    if (!enabled || !userId || hasRun.current) return;
    hasRun.current = true;

    // Check if we already have fresh feed data from MMKV cache
    const existingFeed = queryClient.getQueryData(postKeys.feedInfinite());
    if (existingFeed) {
      trace.markCacheHit();
      trace.markUsable();
      console.log("[BootstrapFeed] Cache hit — skipping bootstrap call");
      return;
    }

    // Fire bootstrap request
    bootstrapApi.feed({ userId }).then((data) => {
      if (!data) {
        console.warn("[BootstrapFeed] Bootstrap failed — falling back to individual queries");
        return;
      }

      hydrateFromBootstrap(queryClient, userId, data);
      trace.markUsable();
    });
  }, [enabled, userId, queryClient, trace]);

  return { enabled };
}
