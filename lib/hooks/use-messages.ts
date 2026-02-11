import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";
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
  filteredConversations: (viewerId: string, filter: string) =>
    [...messageKeys.all, "filtered", filter, viewerId] as const,
  chatMessages: (conversationId: string) =>
    [...messageKeys.all, "chat", conversationId] as const,
};

/**
 * Hook to get unread message count for INBOX ONLY
 *
 * CRITICAL: This count only includes messages from followed users.
 * Spam messages are NOT included in the Messages badge.
 * TanStack Query is the SINGLE source of truth for unread counts.
 *
 * Boot prefetch warms this cache so the badge appears instantly.
 * Background refetch every 30s keeps it fresh.
 */
export function useUnreadMessageCount() {
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
    refetchInterval: 30_000,
  });

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
 * Hook to get filtered conversations (inbox or requests).
 * Uses TanStack Query instead of useState + useEffect.
 */
export function useFilteredConversations(filter: "primary" | "requests") {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id || "";

  return useQuery({
    queryKey: messageKeys.filteredConversations(viewerId, filter),
    queryFn: () => messagesApiClient.getFilteredConversations(filter),
    enabled: !!viewerId,
  });
}

/**
 * Hook to get chat messages for a conversation.
 * TanStack Query owns the data — no Zustand duplication.
 */
export function useChatMessages(conversationId: string) {
  return useQuery({
    queryKey: messageKeys.chatMessages(conversationId),
    queryFn: () => messagesApiClient.getMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

/**
 * Hook to refresh message counts after marking as read.
 * Invalidates TanStack Query cache — the single source of truth.
 */
export function useRefreshMessageCounts() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;

  return async () => {
    if (viewerId) {
      await queryClient.invalidateQueries({
        queryKey: messageKeys.unreadCount(viewerId),
      });
    }
  };
}

/**
 * Optimistic Send Message Mutation
 *
 * 1. Instantly appends message to chat cache with temp ID
 * 2. Sends to backend
 * 3. Reconciles temp message with server response
 * 4. Rolls back on error
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (params: {
      content: string;
      media?: Array<{ uri: string; type: "image" | "video" }>;
    }) =>
      messagesApiClient.sendMessage({
        conversationId,
        content: params.content,
        media: params.media,
      }),

    onMutate: async (params) => {
      await queryClient.cancelQueries({
        queryKey: messageKeys.chatMessages(conversationId),
      });

      const prev = queryClient.getQueryData(
        messageKeys.chatMessages(conversationId),
      );

      // Optimistic message with temp ID
      const tempMessage = {
        id: `temp-${Date.now()}`,
        content: params.content,
        text: params.content,
        sender: "user" as const,
        senderId: user?.id,
        createdAt: new Date().toISOString(),
        media: params.media || [],
        metadata: null,
      };

      queryClient.setQueryData(
        messageKeys.chatMessages(conversationId),
        (old: any[] | undefined) => [...(old || []), tempMessage],
      );

      return { prev };
    },

    onError: (_err, _vars, context) => {
      // Rollback to previous messages
      if (context?.prev) {
        queryClient.setQueryData(
          messageKeys.chatMessages(conversationId),
          context.prev,
        );
      }
    },

    onSuccess: (serverMsg) => {
      // Replace temp message with server response
      queryClient.setQueryData(
        messageKeys.chatMessages(conversationId),
        (old: any[] | undefined) => {
          if (!old) return old;
          // Remove temp messages and append server message
          const withoutTemp = old.filter(
            (m: any) => !String(m.id).startsWith("temp-"),
          );
          return [...withoutTemp, serverMsg];
        },
      );
      // Invalidate conversations list to update lastMessage preview
      queryClient.invalidateQueries({
        queryKey: messageKeys.all,
        predicate: (query) =>
          query.queryKey[1] === "filtered" ||
          query.queryKey[1] === "conversations",
      });
    },
  });
}

/**
 * Optimistic Delete Message Mutation
 */
export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      messagesApiClient.deleteMessage(messageId),

    onMutate: async (messageId) => {
      await queryClient.cancelQueries({
        queryKey: messageKeys.chatMessages(conversationId),
      });

      const prev = queryClient.getQueryData(
        messageKeys.chatMessages(conversationId),
      );

      // Optimistically remove the message
      queryClient.setQueryData(
        messageKeys.chatMessages(conversationId),
        (old: any[] | undefined) =>
          old ? old.filter((m: any) => String(m.id) !== messageId) : old,
      );

      return { prev };
    },

    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(
          messageKeys.chatMessages(conversationId),
          context.prev,
        );
      }
    },
  });
}
