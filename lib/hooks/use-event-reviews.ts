/**
 * Event Reviews Hooks
 *
 * React Query hooks for event ratings and reviews
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventReviews } from "@/lib/api-client";

export const eventReviewKeys = {
  all: ["event-reviews"] as const,
  event: (eventId: string) => [...eventReviewKeys.all, "event", eventId] as const,
};

// Fetch reviews for an event
export function useEventReviews(eventId: string, limit: number = 10) {
  return useQuery({
    queryKey: eventReviewKeys.event(eventId),
    queryFn: async () => {
      const result = await eventReviews.getEventReviews(eventId, { limit });
      return result.docs || [];
    },
    enabled: !!eventId,
  });
}

// Create/update review mutation
export function useCreateEventReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      rating: number;
      comment?: string;
    }) => {
      return await eventReviews.create(data);
    },
    onSuccess: (_, variables) => {
      // Invalidate reviews for this event
      queryClient.invalidateQueries({
        queryKey: eventReviewKeys.event(variables.eventId),
      });
      // Also invalidate event query to update average rating
      queryClient.invalidateQueries({
        queryKey: ["events", variables.eventId],
      });
    },
  });
}
