import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUnreadCountsStore } from "@/lib/stores/unread-counts-store";
import { STALE_TIMES, GC_TIMES } from "@/lib/perf/stale-time-config";

// Query keys - scoped by viewerId for cache isolation
export const messageKeys = {
  all: ["messages"] as const,
  unreadCount: (viewerId?: string) =>
    [...messageKeys.all, "unreadCount", viewerId || "__no_user__"] as const,
  spamUnreadCount: (viewerId?: string) =>
    [...messageKeys.all, "spamUnreadCount", viewerId || "__no_user__"] as const,
  conversations: (viewerId?: string) =>
    [...messageKeys.all, "conversations", viewerId || "__no_user__"] as const,
};

/**
 * Hook to get unread message count for INBOX ONLY
 *
 * CRITICAL: This count only includes messages from followed users.
 * Spam messages are NOT included in the Messages badge.
 * This is the source of truth for the Messages tab badge.
 *
 * Deduplication is handled by TanStack Query staleTime — no manual debounce.
 * Boot prefetch primes this cache so the badge renders instantly.
 */
export function useUnreadMessageCount() {
  const setMessagesUnread = useUnreadCountsStore((s) => s.setMessagesUnread);
  const setSpamUnread = useUnreadCountsStore((s) => s.setSpamUnread);
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  const query = useQuery<{ inbox: number; spam: number }>({
    queryKey: messageKeys.unreadCount(viewerId),
    queryFn: async () => {
      const [inboxCount, spamCount] = await Promise.all([
        messagesApiClient.getUnreadCount(),
        messagesApiClient.getSpamUnreadCount(),
      ]);
      return { inbox: inboxCount, spam: spamCount };
    },
    enabled: !!viewerId,
    staleTime: STALE_TIMES.unreadCounts,
    gcTime: GC_TIMES.short,
    refetchInterval: 30000, // Background refresh every 30s
  });

  // Sync with unread counts store for push notification increments
  useEffect(() => {
    if (query.data) {
      setMessagesUnread(query.data.inbox);
      setSpamUnread(query.data.spam);
    }
  }, [query.data, setMessagesUnread, setSpamUnread]);

  // Return just the inbox count for backwards compatibility
  return {
    ...query,
    data: query.data?.inbox ?? 0,
    spamCount: query.data?.spam ?? 0,
  };
}

// Hook to get conversations
export function useConversations() {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return useQuery({
    queryKey: messageKeys.conversations(viewerId),
    queryFn: messagesApiClient.getConversations,
    enabled: !!viewerId,
    staleTime: STALE_TIMES.conversations,
  });
}

// Hook to get filtered conversations (inbox = followed users, requests = others)
export function useFilteredConversations(filter: "primary" | "requests") {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return useQuery({
    queryKey: [
      ...messageKeys.all,
      "filtered",
      filter,
      viewerId || "__no_user__",
    ],
    queryFn: () => messagesApiClient.getFilteredConversations(filter),
    enabled: !!viewerId,
    staleTime: STALE_TIMES.conversations,
  });
}

/**
 * Hook to refresh message counts after marking as read
 * Call this after opening a conversation
 */
export function useRefreshMessageCounts() {
  const queryClient = useQueryClient();
  const refreshMessagesUnread = useUnreadCountsStore(
    (s) => s.refreshMessagesUnread,
  );
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return async () => {
    // Invalidate query cache - use scoped key
    if (viewerId) {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.unreadCount(viewerId),
      });
    }
    // Also invalidate conversations list so unread flags update
    await queryClient.invalidateQueries({
      queryKey: ["messages", "filtered"],
    });
    // Also refresh store
    await refreshMessagesUnread();
  };
}
