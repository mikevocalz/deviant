import { useQuery } from "@tanstack/react-query";
import { messagesApi as messagesApiClient } from "@/lib/api/supabase-messages";

// Query keys
export const messageKeys = {
  all: ["messages"] as const,
  unreadCount: () => [...messageKeys.all, "unreadCount"] as const,
  conversations: () => [...messageKeys.all, "conversations"] as const,
};

// Hook to get unread message count
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: messageKeys.unreadCount(),
    queryFn: messagesApiClient.getUnreadCount,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
}

// Hook to get conversations
export function useConversations() {
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: messagesApiClient.getConversations,
  });
}
