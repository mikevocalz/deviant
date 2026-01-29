import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { messagesApiClient } from "@/lib/api/messages";
import { useUnreadCountsStore } from "@/lib/stores/unread-counts-store";
import { useAuthStore } from "@/lib/stores/auth-store";

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
 * DEBOUNCED: API calls are debounced to reduce spam
 */
export function useUnreadMessageCount() {
  const setMessagesUnread = useUnreadCountsStore((s) => s.setMessagesUnread);
  const setSpamUnread = useUnreadCountsStore((s) => s.setSpamUnread);
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  // Refs for debouncing
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<number>(0);
  const DEBOUNCE_DELAY = 2000; // 2 seconds
  const MIN_FETCH_INTERVAL = 10000; // Minimum 10 seconds between fetches

  const query = useQuery<{ inbox: number; spam: number }>({
    queryKey: messageKeys.unreadCount(viewerId),
    queryFn: async () => {
      const now = Date.now();

      // Debounce: if we fetched recently, return cached data
      if (now - lastFetchRef.current < MIN_FETCH_INTERVAL) {
        console.log("[useUnreadMessageCount] Using cached data (debounced)");
        // Return existing data from store if available
        return {
          inbox: useUnreadCountsStore.getState().messagesUnread || 0,
          spam: useUnreadCountsStore.getState().spamUnread || 0,
        };
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce the actual API call
      return new Promise((resolve) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            lastFetchRef.current = Date.now();

            // Get inbox unread count (from followed users only)
            const inboxCount = await messagesApiClient.getUnreadCount();
            // Also get spam count for display purposes
            const spamCount = await messagesApiClient.getSpamUnreadCount();

            console.log("[useUnreadMessageCount] Fetched (debounced):", {
              inbox: inboxCount,
              spam: spamCount,
            });

            resolve({ inbox: inboxCount, spam: spamCount });
          } catch (error) {
            console.error(
              "[useUnreadMessageCount] Error fetching counts:",
              error,
            );
            // Return fallback data
            resolve({
              inbox: useUnreadCountsStore.getState().messagesUnread || 0,
              spam: useUnreadCountsStore.getState().spamUnread || 0,
            });
          }
        }, DEBOUNCE_DELAY);
      });
    },
    refetchInterval: 30000, // Refetch every 30 seconds (less frequent)
    staleTime: 15000, // Consider stale after 15 seconds (longer)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Only refetch on reconnect
  });

  // Sync with unread counts store
  useEffect(() => {
    if (query.data) {
      setMessagesUnread(query.data.inbox);
      setSpamUnread(query.data.spam);
    }
  }, [query.data, setMessagesUnread, setSpamUnread]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
    // Also refresh store
    await refreshMessagesUnread();
  };
}
