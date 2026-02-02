/**
 * Event Reviews Hooks
 *
 * React Query hooks for event ratings and reviews
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

export const eventReviewKeys = {
  all: ["event-reviews"] as const,
  event: (eventId: string) => [...eventReviewKeys.all, "event", eventId] as const,
};

// Fetch reviews for an event (uses custom endpoint)
export function useEventReviews(eventId: string, limit: number = 10) {
  return useQuery({
    queryKey: eventReviewKeys.event(eventId),
    queryFn: async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events/${eventId}/reviews?limit=${limit}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[useEventReviews] Fetch failed:", response.status);
        return [];
      }

      const result = await response.json();
      return result.docs || [];
    },
    enabled: !!eventId,
  });
}

// Create/update review mutation (uses custom endpoint)
export function useCreateEventReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      rating: number;
      comment?: string;
    }) => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events/${data.eventId}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            rating: data.rating,
            comment: data.comment || "",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create review: ${response.status}`);
      }

      return await response.json();
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventReviewKeys.event(variables.eventId),
      });
      await queryClient.cancelQueries({
        queryKey: ["events", "detail", variables.eventId],
      });

      // Snapshot previous data
      const previousReviews = queryClient.getQueryData(
        eventReviewKeys.event(variables.eventId),
      );
      const previousEvent = queryClient.getQueryData([
        "events",
        "detail",
        variables.eventId,
      ]);

      // Optimistically add the new review
      queryClient.setQueryData(
        eventReviewKeys.event(variables.eventId),
        (old: any[]) => {
          if (!old) return old;
          const optimisticReview = {
            id: `temp-${Date.now()}`,
            rating: variables.rating,
            comment: variables.comment,
            createdAt: new Date().toISOString(),
          };
          return [...old, optimisticReview];
        },
      );

      // Optimistically update event average rating (simplified)
      queryClient.setQueryData(
        ["events", "detail", variables.eventId],
        (old: any) => {
          if (!old) return old;
          const currentRating = old.averageRating || 0;
          const currentCount = old.reviewCount || 0;
          const newCount = currentCount + 1;
          const newRating =
            (currentRating * currentCount + variables.rating) / newCount;
          return {
            ...old,
            averageRating: newRating,
            reviewCount: newCount,
          };
        },
      );

      return { previousReviews, previousEvent };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousReviews) {
        queryClient.setQueryData(
          eventReviewKeys.event(variables.eventId),
          context.previousReviews,
        );
      }
      if (context?.previousEvent) {
        queryClient.setQueryData(
          ["events", "detail", variables.eventId],
          context.previousEvent,
        );
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to get real data with correct ID and accurate ratings
      queryClient.invalidateQueries({
        queryKey: eventReviewKeys.event(variables.eventId),
      });
      queryClient.invalidateQueries({
        queryKey: ["events", "detail", variables.eventId],
      });
    },
  });
}
