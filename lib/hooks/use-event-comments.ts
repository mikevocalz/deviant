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
    }) => {
      return await eventComments.create(data);
    },
    onSuccess: (_, variables) => {
      // Invalidate comments for this event
      queryClient.invalidateQueries({
        queryKey: eventCommentKeys.event(variables.eventId),
      });
    },
  });
}
