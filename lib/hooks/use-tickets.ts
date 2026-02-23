/**
 * React Query hooks for Tickets + Organizer
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/api/tickets";
import { getCurrentUserAuthId } from "@/lib/api/auth-helper";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { STALE_TIMES, GC_TIMES } from "@/lib/perf/stale-time-config";

export const ticketKeys = {
  all: ["tickets"] as const,
  myTickets: () => [...ticketKeys.all, "mine"] as const,
  myTicketForEvent: (eventId: string) =>
    [...ticketKeys.all, "mine", eventId] as const,
  eventTickets: (eventId: string) =>
    [...ticketKeys.all, "event", eventId] as const,
  ticketTypes: (eventId: string) =>
    [...ticketKeys.all, "types", eventId] as const,
  financials: (eventId: string) =>
    [...ticketKeys.all, "financials", eventId] as const,
};

/** Current user's tickets across all events — always enabled */
export function useMyTickets() {
  const zustandTickets = useTicketStore((s) => s.tickets);

  return useQuery({
    queryKey: ticketKeys.myTickets(),
    queryFn: async () => {
      const dbTickets = await ticketsApi.getMyTickets();

      // Merge Zustand store tickets (from RSVP path) that aren't in DB yet
      const dbEventIds = new Set(dbTickets.map((t) => String(t.event_id)));
      const storeOnlyTickets = Object.values(zustandTickets)
        .filter((t) => !dbEventIds.has(String(t.eventId)))
        .map((t) => ({
          id: t.id,
          event_id: parseInt(t.eventId) || 0,
          ticket_type_id: "",
          user_id: t.userId,
          status: (t.status === "valid" ? "active" : t.status) as
            | "active"
            | "scanned"
            | "refunded"
            | "void",
          qr_token: t.qrToken,
          checked_in_at: t.checkedInAt || null,
          checked_in_by: null,
          purchase_amount_cents: t.paid ? null : 0,
          created_at: new Date().toISOString(),
          ticket_type_name: t.tierName || "Free Entry",
          event_title: t.eventTitle || "",
          event_image: t.eventImage || "",
          event_date: t.eventDate || "",
          event_location: t.eventLocation || "",
        }));

      return [...dbTickets, ...storeOnlyTickets];
    },
    staleTime: STALE_TIMES.bookmarks, // 10min — tickets change only on purchase/scan
    gcTime: GC_TIMES.standard,
  });
}

/** Current user's ticket for a specific event */
export function useMyTicketForEvent(eventId: string) {
  const storeTicket = useTicketStore((s) => s.getTicketByEventId(eventId));

  return useQuery({
    queryKey: ticketKeys.myTicketForEvent(eventId),
    queryFn: () => ticketsApi.getMyTicketForEvent(eventId),
    enabled: !!eventId,
    staleTime: STALE_TIMES.bookmarks,
    gcTime: GC_TIMES.standard,
    // If Zustand store has a ticket (from recent RSVP), use it as placeholder
    placeholderData: storeTicket
      ? ({
          id: storeTicket.id,
          event_id: parseInt(storeTicket.eventId) || 0,
          ticket_type_id: "",
          user_id: storeTicket.userId,
          status: (storeTicket.status === "valid"
            ? "active"
            : storeTicket.status) as any,
          qr_token: storeTicket.qrToken,
          checked_in_at: storeTicket.checkedInAt || null,
          checked_in_by: null,
          purchase_amount_cents: storeTicket.paid ? null : 0,
          created_at: new Date().toISOString(),
          ticket_type_name: storeTicket.tierName || "Free Entry",
          event_title: storeTicket.eventTitle || "",
          event_image: storeTicket.eventImage || "",
          event_date: storeTicket.eventDate || "",
          event_location: storeTicket.eventLocation || "",
        } as any)
      : undefined,
  });
}

/** All tickets for an event (organizer view) */
export function useEventTickets(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.eventTickets(eventId),
    queryFn: () => ticketsApi.getEventTickets(eventId),
    enabled: !!eventId && isFeatureEnabled("organizer_tools_enabled"),
    staleTime: STALE_TIMES.events,
    gcTime: GC_TIMES.short,
  });
}

/** Ticket types for an event */
export function useTicketTypes(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.ticketTypes(eventId),
    queryFn: () => ticketsApi.getTicketTypes(eventId),
    enabled: !!eventId && isFeatureEnabled("ticketing_enabled"),
    staleTime: STALE_TIMES.events,
    gcTime: GC_TIMES.short,
  });
}

/** Event financials (organizer view) */
export function useEventFinancials(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.financials(eventId),
    queryFn: () => ticketsApi.getEventFinancials(eventId),
    enabled: !!eventId && isFeatureEnabled("organizer_tools_enabled"),
    staleTime: STALE_TIMES.events,
    gcTime: GC_TIMES.short,
  });
}

/** Purchase tickets mutation */
export function useCheckoutTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ticketsApi.checkout,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ticketKeys.myTickets(),
      });
      queryClient.invalidateQueries({
        queryKey: ticketKeys.eventTickets(variables.eventId),
      });
      queryClient.invalidateQueries({
        queryKey: ticketKeys.ticketTypes(variables.eventId),
      });
    },
  });
}

/** Scan ticket mutation */
export function useScanTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      qrToken,
      scannedBy,
    }: {
      qrToken: string;
      scannedBy?: string;
      eventId?: string;
    }) => ticketsApi.scanTicket(qrToken, scannedBy),
    onSuccess: (_data, variables) => {
      if (variables.eventId) {
        queryClient.invalidateQueries({
          queryKey: ticketKeys.eventTickets(variables.eventId),
        });
      }
    },
  });
}
