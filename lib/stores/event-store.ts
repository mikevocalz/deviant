import { create } from "zustand"

interface CreateEventState {
  title: string
  date: string
  time: string
  location: string
  price: string
  setTitle: (title: string) => void
  setDate: (date: string) => void
  setTime: (time: string) => void
  setLocation: (location: string) => void
  setPrice: (price: string) => void
  reset: () => void
}

interface EventViewState {
  isRsvped: Record<string, boolean>
  isLiked: Record<string, boolean>
  ticketCount: Record<string, number>
  toggleRsvp: (eventId: string) => void
  toggleLike: (eventId: string) => void
  setTicketCount: (eventId: string, count: number) => void
  incrementTickets: (eventId: string) => void
  decrementTickets: (eventId: string) => void
}

export const useCreateEventStore = create<CreateEventState>((set) => ({
  title: "",
  date: "",
  time: "",
  location: "",
  price: "",
  setTitle: (title) => set({ title }),
  setDate: (date) => set({ date }),
  setTime: (time) => set({ time }),
  setLocation: (location) => set({ location }),
  setPrice: (price) => set({ price }),
  reset: () => set({ title: "", date: "", time: "", location: "", price: "" }),
}))

export const useEventViewStore = create<EventViewState>((set, get) => ({
  isRsvped: {},
  isLiked: {},
  ticketCount: {},
  toggleRsvp: (eventId) => set((state) => ({
    isRsvped: { ...state.isRsvped, [eventId]: !state.isRsvped[eventId] }
  })),
  toggleLike: (eventId) => set((state) => ({
    isLiked: { ...state.isLiked, [eventId]: !state.isLiked[eventId] }
  })),
  setTicketCount: (eventId, count) => set((state) => ({
    ticketCount: { ...state.ticketCount, [eventId]: count }
  })),
  incrementTickets: (eventId) => set((state) => ({
    ticketCount: { ...state.ticketCount, [eventId]: (state.ticketCount[eventId] || 1) + 1 }
  })),
  decrementTickets: (eventId) => set((state) => ({
    ticketCount: { ...state.ticketCount, [eventId]: Math.max(1, (state.ticketCount[eventId] || 1) - 1) }
  })),
}))
