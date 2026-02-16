/**
 * Activities Query Hook — TanStack Query
 *
 * Fetches, transforms, and deduplicates notifications into Activity objects.
 * This enables MMKV persistence so the activity/notifications screen renders
 * instantly on cold start from cache.
 *
 * The Zustand activity-store remains the authority for mutations (markAsRead,
 * toggleFollow) and realtime subscriptions. This hook provides the READ path.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationsApiClient,
  type Notification,
} from "@/lib/api/notifications";
import { useAuthStore } from "@/lib/stores/auth-store";
import { STALE_TIMES } from "@/lib/perf/stale-time-config";

// Re-export Activity type so consumers don't need the store import
export type ActivityType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "tag"
  | "event_invite"
  | "event_update";

export interface Activity {
  id: string;
  type: ActivityType;
  user: {
    id?: string;
    username: string;
    avatar: string;
  };
  entityType?: "post" | "comment" | "user" | "event";
  entityId?: string;
  post?: {
    id: string;
    thumbnail: string;
  };
  event?: {
    id: string;
    title?: string;
  };
  comment?: string;
  timeAgo: string;
  isRead: boolean;
  createdAt?: string;
}

// Query keys
export const activityKeys = {
  all: ["activities"] as const,
  list: (viewerId: string) => ["activities", viewerId] as const,
};

/**
 * Transform a backend Notification into an Activity.
 * DEFENSIVE: never crash on malformed data.
 */
function notificationToActivity(notif: Notification): Activity | null {
  try {
    if (!notif || !notif.id) return null;

    const senderUsername = notif.sender?.username || "user";

    return {
      id: String(notif.id),
      type: (notif.type as ActivityType) || "like",
      user: {
        id: notif.sender?.id || "",
        username: senderUsername,
        avatar: notif.sender?.avatar || "",
      },
      entityType: notif.entityType as
        | "post"
        | "comment"
        | "user"
        | "event"
        | undefined,
      entityId: notif.entityId,
      post: notif.post
        ? {
            id: String(notif.post.id || ""),
            thumbnail: notif.post.thumbnail || "",
          }
        : undefined,
      event: notif.event
        ? {
            id: String(notif.event.id || ""),
            title: notif.event.title,
          }
        : undefined,
      comment: notif.content,
      timeAgo: notificationsApiClient.formatTimeAgo(
        notif.createdAt || new Date().toISOString(),
      ),
      isRead: !!notif.readAt,
      createdAt: notif.createdAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("[ActivitiesQuery] notificationToActivity error:", error);
    return null;
  }
}

/**
 * Fetch, transform, and deduplicate activities.
 */
async function fetchActivities(): Promise<Activity[]> {
  const result = await notificationsApiClient.getNotifications(50);
  const allActivities = (result.docs || [])
    .map((n: Notification) => notificationToActivity(n))
    .filter((a): a is Activity => a !== null);

  // Deduplicate: first by ID, then by composite key (type + actor + entity)
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  return allActivities.filter((a) => {
    if (seenIds.has(a.id)) return false;
    seenIds.add(a.id);
    const compositeKey = `${a.type}:${a.user?.id || ""}:${a.entityId || a.post?.id || ""}`;
    if (seenKeys.has(compositeKey)) return false;
    seenKeys.add(compositeKey);
    return true;
  });
}

/**
 * TanStack Query hook for activities. Enables MMKV persistence
 * so the notifications screen renders instantly on cold start.
 */
export function useActivitiesQuery() {
  const viewerId = useAuthStore((s) => s.user?.id) || "";

  return useQuery({
    queryKey: activityKeys.list(viewerId),
    queryFn: fetchActivities,
    enabled: !!viewerId,
    // Notifications are time-sensitive — override global refetchOnMount: false
    // Shows MMKV cache instantly, then silently refetches in background
    refetchOnMount: true,
    staleTime: STALE_TIMES.activities,
  });
}

/**
 * Helper to get the correct route for an activity item.
 * Pure function — no store dependency.
 */
export function getRouteForActivity(activity: Activity): string {
  const { type, entityType, entityId, post, event, user } = activity;

  // Use entityType/entityId if available (preferred routing)
  if (entityType && entityId) {
    switch (entityType) {
      case "post":
        return `/(protected)/post/${entityId}`;
      case "comment":
        return `/(protected)/post/${entityId}`;
      case "user":
        return `/(protected)/profile/${entityId}`;
      case "event":
        return `/(protected)/events/${entityId}`;
    }
  }

  // Fallback to type-based routing
  switch (type) {
    case "like":
    case "comment":
    case "mention":
    case "tag":
      if (post?.id) {
        return `/(protected)/post/${post.id}`;
      }
      return `/(protected)/profile/${user.username}`;
    case "follow":
      return `/(protected)/profile/${user.username}`;
    case "event_invite":
    case "event_update":
      if (event?.id) {
        return `/(protected)/events/${event.id}`;
      }
      return `/(protected)/events`;
    default:
      return `/(protected)/profile/${user.username}`;
  }
}
