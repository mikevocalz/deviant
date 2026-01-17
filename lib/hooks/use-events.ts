/**
 * React Query hooks for events
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApiClient, type Event } from "@/lib/api/events";

// Query keys
export const eventKeys = {
  all: ["events"] as const,
  list: () => [...eventKeys.all, "list"] as const,
  upcoming: () => [...eventKeys.all, "upcoming"] as const,
  past: () => [...eventKeys.all, "past"] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  byCategory: (category: string) =>
    [...eventKeys.all, "category", category] as const,
};

// Fetch all events
export function useEvents(category?: string) {
  return useQuery({
    queryKey: category ? eventKeys.byCategory(category) : eventKeys.list(),
    queryFn: () => eventsApiClient.getEvents(category),
  });
}

// Fetch upcoming events
export function useUpcomingEvents() {
  return useQuery({
    queryKey: eventKeys.upcoming(),
    queryFn: () => eventsApiClient.getUpcomingEvents(),
  });
}

// Fetch past events
export function usePastEvents() {
  return useQuery({
    queryKey: eventKeys.past(),
    queryFn: () => eventsApiClient.getPastEvents(),
  });
}

// Fetch single event
export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => eventsApiClient.getEventById(id),
    enabled: !!id,
  });
}

// Create event mutation
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApiClient.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export type { Event };
