/**
 * Boot Prefetch Layer
 *
 * Runs ONCE after auth bootstrap in the protected layout.
 * Prefetches all critical data in PARALLEL so every tab renders
 * instantly from cache. This is the #1 fix for "loads in stages".
 *
 * RULES:
 * - Never blocks rendering (fire-and-forget)
 * - All fetches run in parallel via Promise.allSettled
 * - Warms TanStack Query cache so useQuery calls return immediately
 * - Only runs when user is authenticated
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { postKeys } from "@/lib/hooks/use-posts";
import { messageKeys } from "@/lib/hooks/use-messages";
import { postsApi } from "@/lib/api/posts";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";

/**
 * Prefetch all critical data in parallel after auth.
 * Call this in the protected layout — it does NOT block rendering.
 */
export function useBootPrefetch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (!user?.id || hasPrefetched.current) return;
    hasPrefetched.current = true;

    const viewerId = user.id;

    // Fire all prefetches in parallel — never await in render path
    Promise.allSettled([
      // 1. Feed (first page)
      queryClient.prefetchInfiniteQuery({
        queryKey: postKeys.feedInfinite(),
        queryFn: ({ pageParam = 0 }) =>
          postsApi.getFeedPostsPaginated(pageParam),
        initialPageParam: 0,
      }),

      // 2. Unread message count (for badge)
      queryClient.prefetchQuery({
        queryKey: messageKeys.unreadCount(viewerId),
        queryFn: async () => {
          const [inbox, spam] = await Promise.all([
            messagesApiClient.getUnreadCount(),
            messagesApiClient.getSpamUnreadCount(),
          ]);
          return { inbox, spam };
        },
      }),

      // 3. Inbox conversations (for Messages tab — renders instantly)
      queryClient.prefetchQuery({
        queryKey: messageKeys.filteredConversations(viewerId, "primary"),
        queryFn: () => messagesApiClient.getFilteredConversations("primary"),
      }),

      // 4. All conversations (for thread lookup)
      queryClient
        .prefetchQuery({
          queryKey: messageKeys.conversations(viewerId),
          queryFn: () => messagesApiClient.getConversations(),
        })
        .then(() => {
          // 5. Auto-prefetch messages for top 3 most recent threads
          const conversations =
            queryClient.getQueryData<any[]>(
              messageKeys.conversations(viewerId),
            ) || [];
          const top3 = conversations.slice(0, 3);
          return Promise.allSettled(
            top3.map((conv: any) =>
              queryClient.prefetchQuery({
                queryKey: messageKeys.chatMessages(conv.id),
                queryFn: () => messagesApiClient.getMessages(conv.id),
              }),
            ),
          );
        }),
    ]).then((results) => {
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.warn(
          `[BootPrefetch] ${failed.length}/${results.length} prefetches failed`,
        );
      } else {
        console.log(
          `[BootPrefetch] All ${results.length} prefetches succeeded`,
        );
      }
    });
  }, [user?.id, queryClient]);
}
