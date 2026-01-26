/**
 * Event Comments Hooks
 *
 * React Query hooks for event comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventComments } from "@/lib/api-client";

export const eventCommentKeys = {
  all: ["event-comments"] as const,
  event: (eventId: string) => [...eventCommentKeys.all, "event", eventId] as const,
};

// Fetch comments for an event
export function useEventComments(eventId: string, limit: number = 10) {
  return useQuery({
    queryKey: eventCommentKeys.event(eventId),
    queryFn: async () => {
      const result = await eventComments.getEventComments(eventId, { limit });
      return result.docs || [];
    },
    enabled: !!eventId,
  });
}

// Create comment mutation
export function useCreateEventComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      text: string;
      parent?: string;
      authorUsername?: string;
    }) => {
      return await eventComments.create(data);
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventCommentKeys.event(variables.eventId),
      });

      // Snapshot previous data
      const previousComments = queryClient.getQueryData(
        eventCommentKeys.event(variables.eventId),
      );

      // Optimistically add the new comment
      queryClient.setQueryData(
        eventCommentKeys.event(variables.eventId),
        (old: any[]) => {
          if (!old) return old;
          const optimisticComment = {
            id: `temp-${Date.now()}`,
            text: variables.text,
            authorUsername: variables.authorUsername || "You",
            createdAt: new Date().toISOString(),
            parent: variables.parent,
          };
          return [...old, optimisticComment];
        },
      );

      return { previousComments };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(
          eventCommentKeys.event(variables.eventId),
          context.previousComments,
        );
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to get real data with correct ID
      queryClient.invalidateQueries({
        queryKey: eventCommentKeys.event(variables.eventId),
      });
    },
  });
}
