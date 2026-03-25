/**
 * React Query hooks for events
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { eventsApi as eventsApiClient } from "@/lib/api/events";
import { getCurrentUserIdInt } from "@/lib/api/auth-helper";
import { STALE_TIMES } from "@/lib/perf/stale-time-config";
import { useAuthStore } from "@/lib/stores/auth-store";
import { activityKeys } from "@/lib/hooks/use-activities-query";

// Filter params for events home
export type EventSort =
  | "soonest"
  | "newest"
  | "popular"
  | "price_low"
  | "price_high";

export interface EventFilters {
  online?: boolean;
  tonight?: boolean;
  weekend?: boolean;
  search?: string;
  category?: string;
  categories?: string[];
  sort?: EventSort;
  cityId?: number | null;
}

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
  isLiked?: boolean;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  isPromoted?: boolean;
}

// Query keys
export const eventKeys = {
  all: ["events"] as const,
  list: (filters?: EventFilters) =>
    [...eventKeys.all, "list", filters ?? {}] as const,
  upcoming: () => [...eventKeys.all, "upcoming"] as const,
  past: () => [...eventKeys.all, "past"] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  byCategory: (category: string) =>
    [...eventKeys.all, "category", category] as const,
  liked: (userId: number) => [...eventKeys.all, "liked", userId] as const,
  search: (q: string) => [...eventKeys.all, "search", q] as const,
  forYou: () => [...eventKeys.all, "forYou"] as const,
};

function findEventInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  eventId: string,
): Event | undefined {
  const detail = queryClient.getQueryData<Event>(eventKeys.detail(eventId));
  if (detail) return detail;

  const queries = queryClient.getQueriesData<Event[]>({
    queryKey: eventKeys.all,
  });
  for (const [, events] of queries) {
    const match = events?.find((event) => String(event.id) === String(eventId));
    if (match) return match;
  }

  return undefined;
}

// Fetch all events with optional filters
// placeholderData: keepPreviousData keeps old results visible while new filter query loads
// This prevents UI "jump" when toggling filter pills
export function useEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: async () => {
      // Derive category for RPC: single category goes server-side,
      // multi-category fetches all then filters client-side
      const categories = filters?.categories ?? [];
      const singleCategory =
        categories.length === 1
          ? categories[0]
          : (filters?.category ?? undefined);

      const results = await eventsApiClient.getEvents(20, singleCategory, {
        online: filters?.online,
        tonight: filters?.tonight,
        weekend: filters?.weekend,
        search: filters?.search,
        sort: filters?.sort,
        cityId: filters?.cityId,
      });

      // Client-side filter for multi-category (RPC only supports single p_category)
      if (categories.length > 1) {
        const catSet = new Set(categories);
        return results.filter((e: any) => e.category && catSet.has(e.category));
      }
      return results;
    },
    staleTime: STALE_TIMES.events,
    placeholderData: keepPreviousData,
  });
}

// Personalized "For You" events (scored by social + affinity + recency)
export function useForYouEvents() {
  return useQuery({
    queryKey: eventKeys.forYou(),
    queryFn: () => eventsApiClient.getForYouEvents(),
    staleTime: 15 * 60 * 1000, // 15 min cache per audit spec
  });
}

// Search events (debounced from UI)
export function useEventSearch(query: string) {
  return useQuery({
    queryKey: eventKeys.search(query),
    queryFn: () => eventsApiClient.getEvents(30, undefined, { search: query }),
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 min
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
        if (!old || !Array.isArray(old)) return old;
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
            if (!old || !Array.isArray(old)) return old;
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
          if (!old || !Array.isArray(old)) return old;
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

// Toggle event like with optimistic update across all event list caches
export function useToggleEventLike() {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.user?.id) || "";

  return useMutation({
    mutationFn: async ({
      eventId,
      isLiked,
    }: {
      eventId: string;
      isLiked: boolean;
    }) => {
      if (isLiked) {
        await eventsApiClient.unlikeEvent(eventId);
        return { liked: false };
      } else {
        await eventsApiClient.likeEvent(eventId);
        return { liked: true };
      }
    },
    onMutate: async ({ eventId, isLiked }) => {
      // Cancel outgoing refetches for event lists
      await queryClient.cancelQueries({ queryKey: eventKeys.all });

      // Snapshot all event list caches for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: eventKeys.all,
      });
      const previousLikedActivity = viewerId
        ? queryClient.getQueryData(activityKeys.liked(viewerId))
        : undefined;

      // Helper to patch a single event in any event array cache
      const patchEvent = (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((ev: any) =>
          String(ev.id) === eventId
            ? {
                ...ev,
                isLiked: !isLiked,
                likes: isLiked
                  ? Math.max((ev.likes ?? 0) - 1, 0)
                  : (ev.likes ?? 0) + 1,
              }
            : ev,
        );
      };

      // Optimistically update all event list caches
      queryClient.setQueriesData<Event[]>(
        { queryKey: eventKeys.all },
        patchEvent,
      );

      // Also patch event detail cache if it exists
      queryClient.setQueryData(eventKeys.detail(eventId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          isLiked: !isLiked,
          likes: isLiked
            ? Math.max((old.likes ?? 0) - 1, 0)
            : (old.likes ?? 0) + 1,
        };
      });

      if (viewerId && !isLiked) {
        const event = findEventInCache(queryClient, eventId);
        const createdAt = new Date().toISOString();
        queryClient.setQueryData(
          activityKeys.liked(viewerId),
          (old: any[] | undefined) => [
            {
              id: `optimistic-liked-event-${eventId}-${createdAt}`,
              entityType: "event",
              entityId: eventId,
              actor: {
                id: event?.host?.id || "",
                username: event?.host?.username || "host",
                avatar: event?.host?.avatar || "",
              },
              title: event?.title || "An event you liked",
              previewImage: event?.image || "",
              timeAgo: "Just now",
              createdAt,
            },
            ...(old || []),
          ],
        );
      }

      return { previousData, previousLikedActivity };
    },
    onError: (_err, _variables, context) => {
      // Rollback all event caches
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (viewerId && context?.previousLikedActivity !== undefined) {
        queryClient.setQueryData(
          activityKeys.liked(viewerId),
          context.previousLikedActivity,
        );
      }
    },
    onSuccess: (_result, { eventId }) => {
      // Refresh liked events list and event detail
      const uid = getCurrentUserIdInt();
      if (uid) {
        queryClient.invalidateQueries({ queryKey: eventKeys.liked(uid) });
      }
      if (viewerId) {
        queryClient.invalidateQueries({
          queryKey: activityKeys.liked(viewerId),
        });
      }
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

// RSVP to event mutation with optimistic update
// Module-level set to track in-flight RSVP mutations
const pendingRsvpMutations = new Set<string>();

export function useRsvpEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: "going" | "interested" | "not_going";
    }) => {
      // Prevent concurrent RSVP mutations on the same event
      if (pendingRsvpMutations.has(eventId)) {
        console.log(
          `[useRsvpEvent] Mutation already in flight for ${eventId}, skipping`,
        );
        throw new Error("DUPLICATE_RSVP_MUTATION");
      }
      pendingRsvpMutations.add(eventId);
      try {
        return await eventsApiClient.rsvpEvent(eventId, status);
      } finally {
        pendingRsvpMutations.delete(eventId);
      }
    },
    onMutate: async ({ eventId, status }) => {
      await queryClient.cancelQueries({ queryKey: eventKeys.detail(eventId) });

      const previousDetail = queryClient.getQueryData(
        eventKeys.detail(eventId),
      );
      const previousLists = queryClient.getQueriesData({
        queryKey: eventKeys.all,
      });

      // Patch event detail cache
      queryClient.setQueryData(eventKeys.detail(eventId), (old: any) => {
        if (!old) return old;
        const wasGoing = old.userRsvpStatus === "going";
        const isNowGoing = status === "going";
        const delta =
          isNowGoing && !wasGoing ? 1 : !isNowGoing && wasGoing ? -1 : 0;
        return {
          ...old,
          userRsvpStatus: status,
          attendees: Math.max((old.attendees || 0) + delta, 0),
          rsvpCount: Math.max((old.rsvpCount || 0) + delta, 0),
        };
      });

      return { previousDetail, previousLists };
    },
    onError: (err, { eventId }, context) => {
      // Silently ignore duplicate mutations
      if (err.message === "DUPLICATE_RSVP_MUTATION") {
        return;
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          eventKeys.detail(eventId),
          context.previousDetail,
        );
      }
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSuccess: (_result, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({
        queryKey: [...eventKeys.all, "mine"],
      });
    },
  });
}
