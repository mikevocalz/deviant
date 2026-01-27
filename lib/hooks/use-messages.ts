import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { messagesApiClient } from "@/lib/api/messages";
import { useUnreadCountsStore } from "@/lib/stores/unread-counts-store";

// Query keys
export const messageKeys = {
  all: ["messages"] as const,
  unreadCount: () => [...messageKeys.all, "unreadCount"] as const,
  spamUnreadCount: () => [...messageKeys.all, "spamUnreadCount"] as const,
  conversations: () => [...messageKeys.all, "conversations"] as const,
};

/**
 * Hook to get unread message count for INBOX ONLY
 *
 * CRITICAL: This count only includes messages from followed users.
 * Spam messages are NOT included in the Messages badge.
 * This is the source of truth for the Messages tab badge.
 */
export function useUnreadMessageCount() {
  const setMessagesUnread = useUnreadCountsStore((s) => s.setMessagesUnread);
  const setSpamUnread = useUnreadCountsStore((s) => s.setSpamUnread);

  const query = useQuery({
    queryKey: messageKeys.unreadCount(),
    queryFn: async () => {
      // Get inbox unread count (from followed users only)
      const inboxCount = await messagesApiClient.getUnreadCount();
      // Also get spam count for display purposes
      const spamCount = await messagesApiClient.getSpamUnreadCount();

      console.log("[useUnreadMessageCount] Fetched:", {
        inbox: inboxCount,
        spam: spamCount,
      });

      return { inbox: inboxCount, spam: spamCount };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });

  // Sync with unread counts store
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
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: messagesApiClient.getConversations,
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

  return async () => {
    // Invalidate query cache
    await queryClient.invalidateQueries({
      queryKey: messageKeys.unreadCount(),
    });
    // Also refresh store
    await refreshMessagesUnread();
  };
}
