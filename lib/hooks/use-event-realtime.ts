/**
 * useEventRealtime — subscribe to live changes for a single event
 *
 * Listens for UPDATEs on `events` and INSERT/UPDATE/DELETE on
 * `ticket_types` (filtered by event_id) and invalidates the matching
 * React Query keys so the event detail screen + any feed cards that
 * happen to be mounted refresh without a manual pull-to-refresh.
 *
 * Used by the event detail screen. Cards in lists rely on this
 * indirectly: if a list is showing the event, the broader
 * eventKeys.all invalidation catches it.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { eventKeys } from "@/lib/hooks/use-events";

const TICKET_TYPES_KEY = (id: string) =>
  ["tickets", "types", id] as const;

export function useEventRealtime(eventId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return;
    const evIdInt = parseInt(eventId, 10);
    if (!Number.isFinite(evIdInt)) return;

    const channelId = `event-rt:${eventId}:${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${evIdInt}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: eventKeys.detail(eventId),
          });
          queryClient.invalidateQueries({ queryKey: eventKeys.all });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_types",
          filter: `event_id=eq.${evIdInt}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: eventKeys.detail(eventId),
          });
          queryClient.invalidateQueries({
            queryKey: TICKET_TYPES_KEY(eventId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tickets",
          filter: `event_id=eq.${evIdInt}`,
        },
        () => {
          // A new ticket was issued — quantity_sold + attendee counts
          // need to refresh. Soft invalidate so animation has fresh
          // numbers to roll into.
          queryClient.invalidateQueries({
            queryKey: eventKeys.detail(eventId),
          });
          queryClient.invalidateQueries({
            queryKey: TICKET_TYPES_KEY(eventId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${evIdInt}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: eventKeys.detail(eventId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
}

/**
 * useEventsFeedRealtime — subscribe to ALL event updates and patch the
 * matching row in any cached event list. Mount on the events tab and
 * any other screen showing a feed of events. The patch is in-place
 * (no refetch) so the list doesn't reorder or flicker — just the
 * affected card updates.
 */
export function useEventsFeedRealtime(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channelId = `events-feed-rt:${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
        },
        (payload) => {
          const next = payload.new as Record<string, any>;
          if (!next?.id) return;
          const targetId = String(next.id);

          // Patch in-place across every events list cache. Don't
          // invalidate the whole feed — would cause a flicker /
          // reorder. Patch the cards we have.
          queryClient.setQueriesData<any[]>(
            { queryKey: eventKeys.all },
            (old) => {
              if (!old || !Array.isArray(old)) return old;
              let changed = false;
              const patched = old.map((e) => {
                if (String(e?.id) !== targetId) return e;
                changed = true;
                return {
                  ...e,
                  title: next.title ?? e.title,
                  description: next.description ?? e.description,
                  ticketingEnabled:
                    next.ticketing_enabled ?? e.ticketingEnabled,
                  status: next.status ?? e.status,
                  startDate: next.start_date ?? e.startDate,
                  endDate: next.end_date ?? e.endDate,
                };
              });
              return changed ? patched : old;
            },
          );

          // Detail cache for that event also gets a soft invalidate
          queryClient.invalidateQueries({
            queryKey: eventKeys.detail(targetId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
