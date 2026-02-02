/**
 * React Query hooks for events
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi as eventsApiClient } from "@/lib/api/supabase-events";

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
    onMutate: async (newEventData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventKeys.all });

      // Snapshot previous data
      const previousData = queryClient.getQueriesData({
        queryKey: eventKeys.all,
      });

      // Optimistically add the new event to all event lists
      queryClient.setQueriesData<any[]>(
        { queryKey: eventKeys.all },
        (old) => {
          if (!old) return old;
          const optimisticEvent: any = {
            id: `temp-${Date.now()}`,
            title: newEventData.title || "New Event",
            description: newEventData.description,
            date: new Date(newEventData.date || Date.now())
              .getDate()
              .toString()
              .padStart(2, "0"),
            month: new Date(newEventData.date || Date.now())
              .toLocaleString("en-US", { month: "short" })
              .toUpperCase(),
            fullDate: new Date(newEventData.date || Date.now()),
            time: newEventData.time || "",
            location: newEventData.location || "TBA",
            price: newEventData.price || 0,
            image:
              newEventData.image ||
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1000&fit=crop",
            category: newEventData.category || "Event",
            attendees: [],
            totalAttendees: 0,
            likes: 0,
          };
          return [optimisticEvent, ...old];
        },
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Invalidate to get real data with correct ID
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
