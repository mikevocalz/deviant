/**
 * Boot Prefetch Hook — Instagram-grade instant boot
 *
 * Fires ONCE when the authenticated user enters the protected layout.
 *
 * Strategy:
 * 1. MMKV-persisted query cache is restored BEFORE this runs (via PersistQueryClientProvider)
 * 2. If persisted cache exists → UI already rendered instantly from cache
 * 3. This hook fires background refresh in parallel to update stale data
 * 4. prefetchQuery only fetches if cache is stale — no double-fetching fresh data
 *
 * Cache-first flow:
 *   Cold start WITH cache → tabs render instantly from MMKV → this refreshes in background
 *   Cold start WITHOUT cache → tabs show skeletons → this populates cache → UI appears
 *
 * See: .windsurf/workflows/no-waterfall-rules.md
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { postsApi } from "@/lib/api/posts";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";
import { usersApi } from "@/lib/api/users";
import { notificationsApi } from "@/lib/api/notifications";
import { eventsApi as eventsApiClient } from "@/lib/api/events";
import { bookmarksApi } from "@/lib/api/bookmarks";
import { postKeys } from "@/lib/hooks/use-posts";
import { messageKeys } from "@/lib/hooks/use-messages";
import { profileKeys } from "@/lib/hooks/use-profile";
import { notificationKeys } from "@/lib/hooks/use-notifications-query";
import { eventKeys } from "@/lib/hooks/use-events";
import { bookmarkKeys } from "@/lib/hooks/use-bookmarks";
import { activityKeys } from "@/lib/hooks/use-activities-query";
import { getCurrentUserIdInt } from "@/lib/api/auth-helper";
import { useChatStore } from "@/lib/stores/chat-store";

/**
 * Check if the persisted cache has enough data for instant render.
 * If it does, we log "cache-first" mode — the user sees zero loading.
 */
function detectCacheStatus(queryClient: any, userId: string): string {
  const hasFeed = !!queryClient.getQueryData(postKeys.feedInfinite());
  const hasProfile = !!queryClient.getQueryData(profileKeys.byId(userId));
  const hasMessages = !!queryClient.getQueryData(
    messageKeys.unreadCount(userId),
  );
  const hasEvents = !!queryClient.getQueryData(eventKeys.list());
  const hasProfilePosts = !!queryClient.getQueryData(
    postKeys.profilePosts(userId),
  );
  const hasActivities = !!queryClient.getQueryData(activityKeys.list(userId));

  const hits = [
    hasFeed,
    hasProfile,
    hasMessages,
    hasEvents,
    hasProfilePosts,
    hasActivities,
  ].filter(Boolean).length;
  if (hits >= 5) return "full";
  if (hits > 0) return "partial";
  return "empty";
}

export function useBootPrefetch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (!userId || hasPrefetched.current) return;
    hasPrefetched.current = true;

    const t0 = Date.now();
    const cacheStatus = detectCacheStatus(queryClient, userId);

    console.log(
      `[BootPrefetch] Cache status: ${cacheStatus} — ` +
        (cacheStatus === "full"
          ? "instant render from MMKV, refreshing in background"
          : cacheStatus === "partial"
            ? "partial cache hit, filling gaps"
            : "first boot, fetching all critical data"),
    );

    // Fire ALL prefetches in parallel — never sequential
    // prefetchQuery respects staleTime: if cache is fresh, it's a no-op
    Promise.allSettled([
      // 1. Feed (first page)
      queryClient.prefetchInfiniteQuery({
        queryKey: postKeys.feedInfinite(),
        queryFn: ({ pageParam = 0 }: { pageParam: number }) =>
          postsApi.getFeedPostsPaginated(pageParam),
        initialPageParam: 0,
      }),

      // 2. Unread message counts (inbox + spam)
      queryClient.prefetchQuery({
        queryKey: messageKeys.unreadCount(userId),
        queryFn: async () => {
          const [inbox, spam] = await Promise.all([
            messagesApiClient.getUnreadCount(),
            messagesApiClient.getSpamUnreadCount(),
          ]);
          return { inbox, spam };
        },
      }),

      // 3. Conversations list
      queryClient.prefetchQuery({
        queryKey: messageKeys.conversations(userId),
        queryFn: messagesApiClient.getConversations,
      }),

      // 4. My profile
      queryClient.prefetchQuery({
        queryKey: profileKeys.byId(userId),
        queryFn: async () => {
          const profile = await usersApi.getProfileById(userId);
          return profile;
        },
      }),

      // 5. Notifications / activity
      queryClient.prefetchQuery({
        queryKey: notificationKeys.list(userId),
        queryFn: async () => {
          const response = await notificationsApi.get({ limit: 50 });
          return response.docs || [];
        },
      }),

      // 6. Notification badges
      queryClient.prefetchQuery({
        queryKey: notificationKeys.badges(userId),
        queryFn: () => notificationsApi.getBadges(),
      }),

      // 7. Events list (events tab)
      queryClient.prefetchQuery({
        queryKey: eventKeys.list(),
        queryFn: () => eventsApiClient.getEvents(20),
      }),

      // 8. Profile posts (profile tab — user's own posts grid)
      queryClient.prefetchQuery({
        queryKey: postKeys.profilePosts(userId),
        queryFn: () => postsApi.getProfilePosts(userId),
      }),

      // 9. Bookmarks (profile tab — saved posts)
      queryClient.prefetchQuery({
        queryKey: bookmarkKeys.list(),
        queryFn: () => bookmarksApi.getBookmarks(),
      }),

      // 10. Filtered conversations — inbox (messages screen)
      queryClient.prefetchQuery({
        queryKey: [...messageKeys.all, "filtered", "primary", userId],
        queryFn: () => messagesApiClient.getFilteredConversations("primary"),
      }),

      // 11. My events (profile tab — hosting + RSVP'd)
      queryClient.prefetchQuery({
        queryKey: [...eventKeys.all, "mine"] as const,
        queryFn: () => eventsApiClient.getMyEvents(),
      }),

      // 12. Liked events (profile tab)
      (() => {
        const userIdInt = getCurrentUserIdInt();
        if (!userIdInt) return Promise.resolve();
        return queryClient.prefetchQuery({
          queryKey: eventKeys.liked(userIdInt),
          queryFn: () => eventsApiClient.getLikedEvents(userIdInt),
        });
      })(),

      // 13. Activities (notifications tab — transformed + deduped)
      queryClient.prefetchQuery({
        queryKey: activityKeys.list(userId),
        queryFn: async () => {
          const { notificationsApiClient: nApi } =
            await import("@/lib/api/notifications");
          const result = await nApi.getNotifications(50);
          // Lightweight transform inline — full transform happens in useActivitiesQuery
          return (result.docs || [])
            .map((n: any) => ({
              id: String(n.id),
              type: n.type || "like",
              user: {
                id: n.sender?.id || "",
                username: n.sender?.username || "user",
                avatar: n.sender?.avatar || "",
              },
              entityType: n.entityType,
              entityId: n.entityId,
              post: n.post
                ? {
                    id: String(n.post.id || ""),
                    thumbnail: n.post.thumbnail || "",
                  }
                : undefined,
              event: n.event
                ? { id: String(n.event.id || ""), title: n.event.title }
                : undefined,
              comment: n.content,
              timeAgo: "",
              isRead: !!n.readAt,
              createdAt: n.createdAt || new Date().toISOString(),
            }))
            .filter((a: any) => a.id);
        },
      }),
    ]).then((results) => {
      const elapsed = Date.now() - t0;
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(
        `[BootPrefetch] Done in ${elapsed}ms — ${succeeded} succeeded, ${failed} failed` +
          (cacheStatus === "full"
            ? " (background refresh)"
            : " (initial load)"),
      );

      if (__DEV__) {
        const labels = [
          "feed",
          "unreadCounts",
          "conversations",
          "profile",
          "notifications",
          "badges",
          "events",
          "profilePosts",
          "bookmarks",
          "filteredConversations",
          "myEvents",
          "likedEvents",
          "activities",
        ];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.warn(
              `[BootPrefetch] ${labels[i]} failed:`,
              (r as PromiseRejectedResult).reason,
            );
          }
        });
      }

      // Phase 2: Prefetch chat messages for top 3 conversations
      // This runs AFTER conversations are cached so chat screens render instantly
      try {
        const conversations = queryClient.getQueryData<any[]>(
          messageKeys.conversations(userId),
        );
        if (conversations && conversations.length > 0) {
          const top3 = conversations.slice(0, 3);
          console.log(
            `[BootPrefetch] Prefetching messages for ${top3.length} top conversations`,
          );
          top3.forEach((conv: any) => {
            if (conv?.id) {
              useChatStore.getState().loadMessages(String(conv.id));
            }
          });
        }
      } catch (err) {
        console.warn("[BootPrefetch] Chat prefetch failed:", err);
      }
    });
  }, [userId, queryClient]);
}
