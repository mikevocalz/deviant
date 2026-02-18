import { create } from "zustand";
import type { EventFilter } from "@/components/events/filter-pills";
import type { EventSort } from "@/lib/hooks/use-events";

interface EventsScreenState {
  // Tab
  activeTab: number;
  setActiveTab: (tab: number) => void;

  // Filters
  activeFilters: EventFilter[];
  toggleFilter: (filter: EventFilter) => void;

  // Sort
  activeSort: EventSort;
  cycleSort: () => void;

  // Search
  searchQuery: string;
  debouncedSearch: string;
  setSearchQuery: (query: string) => void;
  setDebouncedSearch: (query: string) => void;

  // City picker
  cityPickerVisible: boolean;
  setCityPickerVisible: (visible: boolean) => void;

  // Map view
  showMapView: boolean;
  toggleMapView: () => void;
}

const SORT_OPTIONS: EventSort[] = [
  "soonest",
  "newest",
  "popular",
  "price_low",
  "price_high",
];

export const useEventsScreenStore = create<EventsScreenState>((set, get) => ({
  activeTab: 0,
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeFilters: [],
  toggleFilter: (filter) =>
    set((s) => ({
      activeFilters: s.activeFilters.includes(filter)
        ? s.activeFilters.filter((f) => f !== filter)
        : [...s.activeFilters, filter],
    })),

  activeSort: "soonest",
  cycleSort: () =>
    set((s) => {
      const idx = SORT_OPTIONS.indexOf(s.activeSort);
      return { activeSort: SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length] };
    }),

  searchQuery: "",
  debouncedSearch: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDebouncedSearch: (query) => set({ debouncedSearch: query }),

  cityPickerVisible: false,
  setCityPickerVisible: (visible) => set({ cityPickerVisible: visible }),

  showMapView: false,
  toggleMapView: () => set((s) => ({ showMapView: !s.showMapView })),
}));
