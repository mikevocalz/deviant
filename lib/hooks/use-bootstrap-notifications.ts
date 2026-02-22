/**
 * Bootstrap Notifications Hook
 *
 * When `perf_bootstrap_notifications` flag is ON, fetches all activity
 * above-the-fold data in a single request and hydrates the TanStack Query cache.
 *
 * Eliminates: useActivitiesQuery + fetchFollowingState + getBadges waterfall.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  bootstrapApi,
  type BootstrapNotificationsResponse,
} from "@/lib/api/bootstrap";
import { activityKeys } from "@/lib/hooks/use-activities-query";
import { notificationKeys } from "@/lib/hooks/use-notifications-query";
import { useActivityStore } from "@/lib/stores/activity-store";
import { useScreenTrace } from "@/lib/perf/screen-trace";

function hydrateFromNotificationsBootstrap(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  data: BootstrapNotificationsResponse,
) {
  // viewerFollowing is now keyed by USERNAME (fixed server-side)
  const viewerFollowingByUsername = data.viewerFollowing || {};

  // 1. Seed the activities query cache — embed viewerFollows directly
  const activities = data.activities.map((a) => {
    const username = a.actor.username;
    // Use actor.viewerFollows (embedded by server) or fall back to username map
    const viewerFollows =
      a.actor.viewerFollows ?? !!viewerFollowingByUsername[username];

    return {
      id: a.id,
      type: a.type || "like",
      user: {
        id: a.actor.id,
        username,
        avatar: a.actor.avatarUrl,
        viewerFollows,
      },
      entityType: a.entityType,
      entityId: a.entityId,
      post: a.post
        ? { id: a.post.id, thumbnail: a.post.thumbnailUrl }
        : undefined,
      comment: a.commentText,
      timeAgo: "",
      isRead: a.isRead,
      createdAt: a.createdAt,
    };
  });

  queryClient.setQueryData(activityKeys.list(userId), activities);

  // 2. Seed badge count
  queryClient.setQueryData(notificationKeys.badges(userId), {
    unreadCount: data.unreadCount,
  });

  // 3. Seed follow state in activity store — NOW USING USERNAMES (not IDs)
  const followedSet = new Set(
    Object.entries(viewerFollowingByUsername)
      .filter(([, isFollowing]) => isFollowing)
      .map(([username]) => username),
  );
  useActivityStore.setState({ followedUsers: followedSet });

  console.log(
    `[BootstrapNotifications] Hydrated cache: ${activities.length} activities, ` +
      `${data.unreadCount} unread, ${followedSet.size} followed (by username)`,
  );
}

export function useBootstrapNotifications() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) || "";
  const hasRun = useRef(false);
  const trace = useScreenTrace("Activity");

  const enabled = isFeatureEnabled("perf_bootstrap_notifications");

  useEffect(() => {
    if (!enabled || !userId || hasRun.current) return;
    hasRun.current = true;

    // Check if we already have fresh activity data from MMKV cache
    const existingActivities = queryClient.getQueryData(
      activityKeys.list(userId),
    );
    if (existingActivities) {
      trace.markCacheHit();
      trace.markUsable();
      return;
    }

    bootstrapApi.notifications({ userId }).then((data) => {
      if (!data) return;
      hydrateFromNotificationsBootstrap(queryClient, userId, data);
      trace.markUsable();
    });
  }, [enabled, userId, queryClient, trace]);

  return { enabled };
}
