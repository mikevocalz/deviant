/**
 * React Query hooks for Tickets + Organizer
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/api/tickets";
import { getCurrentUserAuthId } from "@/lib/api/auth-helper";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const ticketKeys = {
  all: ["tickets"] as const,
  myTickets: () => [...ticketKeys.all, "mine"] as const,
  eventTickets: (eventId: string) => [...ticketKeys.all, "event", eventId] as const,
  ticketTypes: (eventId: string) => [...ticketKeys.all, "types", eventId] as const,
  financials: (eventId: string) => [...ticketKeys.all, "financials", eventId] as const,
};

/** Current user's tickets across all events */
export function useMyTickets() {
  return useQuery({
    queryKey: ticketKeys.myTickets(),
    queryFn: () => ticketsApi.getMyTickets(),
    enabled: isFeatureEnabled("ticketing_enabled"),
  });
}

/** All tickets for an event (organizer view) */
export function useEventTickets(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.eventTickets(eventId),
    queryFn: () => ticketsApi.getEventTickets(eventId),
    enabled: !!eventId && isFeatureEnabled("organizer_tools_enabled"),
  });
}

/** Ticket types for an event */
export function useTicketTypes(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.ticketTypes(eventId),
    queryFn: () => ticketsApi.getTicketTypes(eventId),
    enabled: !!eventId && isFeatureEnabled("ticketing_enabled"),
  });
}

/** Event financials (organizer view) */
export function useEventFinancials(eventId: string) {
  return useQuery({
    queryKey: ticketKeys.financials(eventId),
    queryFn: () => ticketsApi.getEventFinancials(eventId),
    enabled: !!eventId && isFeatureEnabled("organizer_tools_enabled"),
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
