/**
 * Boot Prefetch Hook
 *
 * Fires ONCE when the authenticated user enters the protected layout.
 * Uses Promise.allSettled to prefetch all critical data in parallel,
 * priming the TanStack Query cache so every screen renders instantly.
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
import { postKeys } from "@/lib/hooks/use-posts";
import { messageKeys } from "@/lib/hooks/use-messages";
import { profileKeys } from "@/lib/hooks/use-profile";
import { notificationKeys } from "@/lib/hooks/use-notifications-query";
import { useChatStore } from "@/lib/stores/chat-store";

export function useBootPrefetch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (!userId || hasPrefetched.current) return;
    hasPrefetched.current = true;

    const t0 = Date.now();
    console.log("[BootPrefetch] Starting parallel prefetch for user:", userId);

    // Fire ALL prefetches in parallel — never sequential
    Promise.allSettled([
      // 1. Feed (first page)
      queryClient.prefetchInfiniteQuery({
        queryKey: postKeys.feedInfinite(),
        queryFn: ({ pageParam = 0 }) =>
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
    ]).then((results) => {
      const elapsed = Date.now() - t0;
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(
        `[BootPrefetch] Done in ${elapsed}ms — ${succeeded} succeeded, ${failed} failed`,
      );

      if (__DEV__) {
        const labels = [
          "feed",
          "unreadCounts",
          "conversations",
          "profile",
          "notifications",
          "badges",
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
