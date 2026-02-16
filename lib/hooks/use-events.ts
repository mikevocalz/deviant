/**
 * React Query hooks for events
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi as eventsApiClient } from "@/lib/api/events";
import { getCurrentUserIdInt } from "@/lib/api/auth-helper";
import { STALE_TIMES } from "@/lib/perf/stale-time-config";

// Event type for components
export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  image: string;
  price: number;
  attendees: number | { image?: string; initials?: string }[];
  totalAttendees?: number;
  images?: { type: string; url: string }[];
  youtubeVideoUrl?: string | null;
  maxAttendees?: number;
  host: {
    id?: string;
    username: string;
    avatar: string;
  };
  coOrganizer?: any;
  month?: string;
  fullDate?: string;
  time?: string;
  category?: string;
  likes?: number;
}

// Query keys
export const eventKeys = {
  all: ["events"] as const,
  list: () => [...eventKeys.all, "list"] as const,
  upcoming: () => [...eventKeys.all, "upcoming"] as const,
  past: () => [...eventKeys.all, "past"] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  byCategory: (category: string) =>
    [...eventKeys.all, "category", category] as const,
  liked: (userId: number) => [...eventKeys.all, "liked", userId] as const,
};

// Fetch all events
export function useEvents(category?: string) {
  return useQuery({
    queryKey: category ? eventKeys.byCategory(category) : eventKeys.list(),
    queryFn: () => eventsApiClient.getEvents(20, category),
    staleTime: STALE_TIMES.events,
  });
}

// Fetch current user's events (hosting + RSVP'd)
export function useMyEvents() {
  return useQuery({
    queryKey: [...eventKeys.all, "mine"] as const,
    queryFn: () => eventsApiClient.getMyEvents(),
    staleTime: STALE_TIMES.events,
  });
}

// Fetch upcoming events
export function useUpcomingEvents() {
  return useQuery({
    queryKey: eventKeys.upcoming(),
    queryFn: () => eventsApiClient.getUpcomingEvents(),
    staleTime: STALE_TIMES.events,
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
      queryClient.setQueriesData<any[]>({ queryKey: eventKeys.all }, (old) => {
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
      });

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
    onSuccess: (newEvent) => {
      console.log("[useCreateEvent] Event created successfully:", newEvent?.id);

      // Replace the optimistic event with the real one instead of invalidating
      // This prevents double events from appearing
      if (newEvent?.id) {
        queryClient.setQueriesData<any[]>(
          { queryKey: eventKeys.all },
          (old) => {
            if (!old) return old;
            // Remove temp events and add real event at the beginning
            const filteredData = old.filter(
              (e) => !String(e.id).startsWith("temp-"),
            );
            return [newEvent, ...filteredData];
          },
        );
      }
    },
  });
}

// Update event mutation
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: any }) =>
      eventsApiClient.updateEvent(eventId, updates),
    onSuccess: (_result, { eventId }) => {
      // Invalidate the specific event and all event lists
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

// Delete event mutation with optimistic update
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApiClient.deleteEvent,
    onMutate: async (deletedEventId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventKeys.all });

      // Snapshot previous data for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: eventKeys.all,
      });

      // Optimistically remove from all event lists
      queryClient.setQueriesData<Event[]>(
        { queryKey: eventKeys.all },
        (old) => {
          if (!old) return old;
          return old.filter((event) => event.id !== deletedEventId);
        },
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: eventKeys.detail(deletedEventId) });

      return { previousData };
    },
    onError: (_err, _deletedEventId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (_result, deletedEventId) => {
      console.log(
        "[useDeleteEvent] Event deleted successfully:",
        deletedEventId,
      );
      // No need to invalidate - optimistic update already removed the event
    },
  });
}

// Fetch events liked/saved by the current user
export function useLikedEvents() {
  const userId = getCurrentUserIdInt();
  return useQuery({
    queryKey: eventKeys.liked(userId || 0),
    queryFn: () => eventsApiClient.getLikedEvents(userId!),
    enabled: !!userId,
  });
}

// RSVP to event mutation
export function useRsvpEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      status,
    }: {
      eventId: string;
      status: "going" | "interested" | "not_going";
    }) => eventsApiClient.rsvpEvent(eventId, status),
    onSuccess: (_result, { eventId }) => {
      // Invalidate the specific event
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}
