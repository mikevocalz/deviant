import { create } from "zustand"

export type TicketStatus = "valid" | "checked_in" | "revoked"

export interface Ticket {
  id: string
  eventId: string
  userId: string
  paid: boolean
  status: TicketStatus
  checkedInAt?: string
  qrToken: string
  qrSvg?: string
  qrPngUrl?: string
  applePassUrl?: string
  googlePassUrl?: string
}

interface TicketStore {
  tickets: Record<string, Ticket>
  setTicket: (eventId: string, ticket: Ticket) => void
  getTicketByEventId: (eventId: string) => Ticket | undefined
  clearTicket: (eventId: string) => void
  hasValidTicket: (eventId: string) => boolean
}

const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33"><path fill="#fff" d="M0 0h33v33H0z"/><path d="M0 0h7v1H0zM8 0h1v1H8zM10 0h1v1h-1zM12 0h2v1h-2zM17 0h1v1h-1zM19 0h3v1h-3zM24 0h2v1h-2zM26 0h7v1h-7zM0 1h1v1H0zM6 1h1v1H6zM8 1h2v1H8zM12 1h1v1h-1zM14 1h1v1h-1zM16 1h2v1h-2zM20 1h1v1h-1zM22 1h1v1h-1zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1H0zM2 2h3v1H2zM6 2h1v1H6zM10 2h1v1h-1zM12 2h1v1h-1zM15 2h2v1h-2zM18 2h1v1h-1zM20 2h2v1h-2zM26 2h1v1h-1zM28 2h3v1h-3zM32 2h1v1h-1zM0 3h1v1H0zM2 3h3v1H2zM6 3h1v1H6zM8 3h1v1H8zM11 3h3v1h-3zM15 3h1v1h-1zM18 3h1v1h-1zM21 3h3v1h-3zM26 3h1v1h-1zM28 3h3v1h-3zM32 3h1v1h-1zM0 4h1v1H0zM2 4h3v1H2zM6 4h1v1H6zM8 4h2v1H8zM12 4h3v1h-3zM17 4h2v1h-2zM20 4h1v1h-1zM22 4h2v1h-2zM26 4h1v1h-1zM28 4h3v1h-3zM32 4h1v1h-1zM0 5h1v1H0zM6 5h1v1H6zM9 5h1v1H9zM11 5h1v1h-1zM14 5h1v1h-1zM17 5h2v1h-2zM21 5h1v1h-1zM23 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h7v1H0zM8 6h1v1H8zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h7v1h-7zM9 7h1v1H9zM11 7h2v1h-2zM14 7h3v1h-3zM19 7h2v1h-2zM23 7h1v1h-1zM0 8h2v1H0zM3 8h1v1H3zM5 8h2v1H5zM10 8h2v1h-2zM13 8h2v1h-2zM17 8h4v1h-4zM22 8h1v1h-1zM25 8h2v1h-2zM28 8h2v1h-2zM31 8h2v1h-2zM1 9h1v1H1zM4 9h2v1H4zM7 9h2v1H7zM10 9h1v1h-1zM12 9h2v1h-2zM15 9h1v1h-1zM18 9h2v1h-2zM22 9h2v1h-2zM27 9h2v1h-2zM30 9h1v1h-1zM0 10h1v1H0zM2 10h1v1H2zM5 10h1v1H5zM8 10h4v1H8zM14 10h4v1h-4zM20 10h2v1h-2zM24 10h3v1h-3zM29 10h1v1h-1zM31 10h2v1h-2zM0 11h2v1H0zM3 11h2v1H3zM7 11h1v1H7zM10 11h1v1h-1zM13 11h1v1h-1zM16 11h1v1h-1zM20 11h1v1h-1zM23 11h2v1h-2zM27 11h1v1h-1zM30 11h3v1h-3zM0 12h1v1H0zM3 12h3v1H3zM8 12h1v1H8zM11 12h1v1h-1zM14 12h2v1h-2zM19 12h2v1h-2zM22 12h1v1h-1zM25 12h2v1h-2zM28 12h1v1h-1zM31 12h1v1h-1zM1 13h1v1H1zM4 13h1v1H4zM7 13h2v1H7zM10 13h1v1h-1zM13 13h2v1h-2zM17 13h1v1h-1zM20 13h2v1h-2zM24 13h1v1h-1zM27 13h2v1h-2zM31 13h2v1h-2zM0 14h2v1H0zM5 14h1v1H5zM8 14h3v1H8zM13 14h1v1h-1zM16 14h2v1h-2zM19 14h1v1h-1zM22 14h2v1h-2zM26 14h1v1h-1zM29 14h2v1h-2zM1 15h2v1H1zM4 15h2v1H4zM9 15h1v1H9zM12 15h2v1h-2zM15 15h1v1h-1zM18 15h2v1h-2zM21 15h1v1h-1zM25 15h1v1h-1zM28 15h3v1h-3zM0 16h1v1H0zM3 16h1v1H3zM6 16h2v1H6zM10 16h2v1h-2zM14 16h1v1h-1zM17 16h2v1h-2zM20 16h1v1h-1zM23 16h2v1h-2zM27 16h1v1h-1zM30 16h2v1h-2zM1 17h1v1H1zM4 17h3v1H4zM9 17h1v1H9zM11 17h1v1h-1zM13 17h2v1h-2zM16 17h1v1h-1zM19 17h2v1h-2zM22 17h1v1h-1zM25 17h2v1h-2zM29 17h1v1h-1zM32 17h1v1h-1zM0 18h2v1H0zM5 18h1v1H5zM8 18h2v1H8zM12 18h1v1h-1zM15 18h2v1h-2zM18 18h1v1h-1zM21 18h2v1h-2zM24 18h1v1h-1zM27 18h2v1h-2zM31 18h1v1h-1zM1 19h2v1H1zM6 19h1v1H6zM9 19h2v1H9zM13 19h1v1h-1zM16 19h1v1h-1zM19 19h2v1h-2zM23 19h1v1h-1zM26 19h2v1h-2zM30 19h2v1h-2zM0 20h1v1H0zM3 20h2v1H3zM7 20h1v1H7zM10 20h1v1h-1zM14 20h2v1h-2zM17 20h1v1h-1zM20 20h2v1h-2zM24 20h1v1h-1zM28 20h1v1h-1zM31 20h2v1h-2zM2 21h1v1H2zM4 21h2v1H4zM8 21h2v1H8zM11 21h1v1h-1zM15 21h1v1h-1zM18 21h2v1h-2zM22 21h1v1h-1zM25 21h2v1h-2zM29 21h2v1h-2zM0 22h2v1H0zM5 22h1v1H5zM9 22h1v1H9zM12 22h2v1h-2zM16 22h1v1h-1zM19 22h1v1h-1zM23 22h2v1h-2zM27 22h1v1h-1zM30 22h1v1h-1zM1 23h1v1H1zM3 23h3v1H3zM8 23h1v1H8zM10 23h1v1h-1zM13 23h2v1h-2zM17 23h2v1h-2zM21 23h1v1h-1zM24 23h2v1h-2zM28 23h2v1h-2zM32 23h1v1h-1zM0 24h1v1H0zM4 24h1v1H4zM7 24h2v1H7zM11 24h1v1h-1zM14 24h1v1h-1zM18 24h1v1h-1zM20 24h2v1h-2zM25 24h1v1h-1zM28 24h1v1h-1zM31 24h2v1h-2zM8 25h2v1H8zM12 25h3v1h-3zM17 25h1v1h-1zM19 25h2v1h-2zM22 25h2v1h-2zM26 25h2v1h-2zM29 25h1v1h-1zM0 26h7v1H0zM8 26h1v1H8zM11 26h1v1h-1zM14 26h2v1h-2zM18 26h1v1h-1zM21 26h1v1h-1zM24 26h1v1h-1zM27 26h2v1h-2zM30 26h3v1h-3zM0 27h1v1H0zM6 27h1v1H6zM9 27h2v1H9zM13 27h1v1h-1zM16 27h2v1h-2zM20 27h1v1h-1zM23 27h2v1h-2zM28 27h1v1h-1zM31 27h1v1h-1zM0 28h1v1H0zM2 28h3v1H2zM6 28h1v1H6zM10 28h1v1h-1zM14 28h1v1h-1zM17 28h2v1h-2zM21 28h1v1h-1zM25 28h1v1h-1zM29 28h2v1h-2zM0 29h1v1H0zM2 29h3v1H2zM6 29h1v1H6zM8 29h3v1H8zM12 29h2v1h-2zM15 29h1v1h-1zM18 29h2v1h-2zM22 29h1v1h-1zM24 29h2v1h-2zM27 29h1v1h-1zM30 29h2v1h-2zM0 30h1v1H0zM2 30h3v1H2zM6 30h1v1H6zM9 30h1v1H9zM11 30h2v1h-2zM14 30h1v1h-1zM17 30h1v1h-1zM20 30h2v1h-2zM23 30h1v1h-1zM26 30h2v1h-2zM29 30h1v1h-1zM32 30h1v1h-1zM0 31h1v1H0zM6 31h1v1H6zM10 31h1v1h-1zM13 31h2v1h-2zM16 31h1v1h-1zM19 31h2v1h-2zM22 31h1v1h-1zM25 31h1v1h-1zM28 31h2v1h-2zM31 31h2v1h-2zM0 32h7v1H0zM8 32h2v1H8zM12 32h1v1h-1zM15 32h2v1h-2zM18 32h1v1h-1zM21 32h2v1h-2zM24 32h1v1h-1zM27 32h1v1h-1zM30 32h1v1h-1z"/></svg>'

const TEST_TICKET: Ticket = {
  id: "tkt_2025011300001",
  eventId: "lower-east-side-winter-bar-fest",
  userId: "user_current",
  paid: true,
  status: "valid",
  qrToken: "eyJ0aWQiOiJ0a3RfMjAyNTAxMTMwMDAwMSIsImVpZCI6Imxvd2VyLWVhc3Qtc2lkZS13aW50ZXItYmFyLWZlc3QifQ",
  qrSvg: QR_SVG,
}

export const useTicketStore = create<TicketStore>((set, get) => ({
  tickets: {
    [TEST_TICKET.eventId]: TEST_TICKET,
  },
  
  setTicket: (eventId, ticket) => set((state) => ({
    tickets: { ...state.tickets, [eventId]: ticket }
  })),
  
  getTicketByEventId: (eventId) => get().tickets[eventId],
  
  clearTicket: (eventId) => set((state) => {
    const { [eventId]: _, ...rest } = state.tickets
    return { tickets: rest }
  }),
  
  hasValidTicket: (eventId) => {
    const ticket = get().tickets[eventId]
    return ticket ? ticket.paid && ticket.status === "valid" : false
  },
}))
