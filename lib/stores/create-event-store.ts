/**
 * Create Event Store — MMKV-persisted Zustand store
 *
 * Replaces all useState in create.tsx with a single persisted store.
 * Draft auto-saves on every field change. User can resume after app restart.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mmkvStorage } from "@/lib/mmkv-zustand";

type VisibilityOption = "public" | "private" | "link_only";
type AgeRestriction = "none" | "18+" | "21+";

interface LocationData {
  name: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

interface TicketTier {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  maxPerUser: number;
  description: string;
  saleStart: string;
  saleEnd: string;
}

// Fields that persist as a draft
interface DraftFields {
  title: string;
  description: string;
  location: string;
  locationData: LocationData | null;
  eventImages: string[];
  tags: string[];
  eventDate: string; // ISO string — Date can't be serialized
  endDate: string | null;
  ticketPrice: string;
  maxAttendees: string;
  youtubeUrl: string;
  ticketingEnabled: boolean;
  visibility: VisibilityOption;
  ageRestriction: AgeRestriction;
  isOnline: boolean;
  dressCode: string;
  doorPolicy: string;
  lineup: string[];
  perks: string[];
  ticketTiers: TicketTier[];
}

// UI-only fields (not persisted, but in store to comply with no-useState rule)
interface UIFields {
  showDatePicker: boolean;
  showTimePicker: boolean;
  showEndDatePicker: boolean;
  showEndTimePicker: boolean;
  isSubmitting: boolean;
  uploadProgress: number;
  customTag: string;
  lineupInput: string;
  perksInput: string;
  ticketTierName: string;
}

interface CreateEventActions {
  // Draft field setters
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setLocation: (v: string) => void;
  setLocationData: (v: LocationData | null) => void;
  setEventImages: (v: string[] | ((prev: string[]) => string[])) => void;
  setTags: (v: string[] | ((prev: string[]) => string[])) => void;
  setEventDate: (v: string) => void;
  setEndDate: (v: string | null) => void;
  setTicketPrice: (v: string) => void;
  setMaxAttendees: (v: string) => void;
  setYoutubeUrl: (v: string) => void;
  setTicketingEnabled: (v: boolean) => void;
  setVisibility: (v: VisibilityOption) => void;
  setAgeRestriction: (v: AgeRestriction) => void;
  setIsOnline: (v: boolean) => void;
  setDressCode: (v: string) => void;
  setDoorPolicy: (v: string) => void;
  setLineup: (v: string[] | ((prev: string[]) => string[])) => void;
  setPerks: (v: string[] | ((prev: string[]) => string[])) => void;
  setTicketTiers: (v: TicketTier[] | ((prev: TicketTier[]) => TicketTier[])) => void;

  // UI-only setters
  setShowDatePicker: (v: boolean) => void;
  setShowTimePicker: (v: boolean) => void;
  setShowEndDatePicker: (v: boolean) => void;
  setShowEndTimePicker: (v: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  setUploadProgress: (v: number) => void;
  setCustomTag: (v: string) => void;
  setLineupInput: (v: string) => void;
  setPerksInput: (v: string) => void;
  setTicketTierName: (v: string) => void;

  // Helpers
  toggleTag: (tag: string) => void;
  addCustomTag: () => void;
  addLineupItem: () => void;
  addPerk: () => void;
  hasDraft: () => boolean;
  resetDraft: () => void;
}

type CreateEventState = DraftFields & UIFields & CreateEventActions;

const DRAFT_DEFAULTS: DraftFields = {
  title: "",
  description: "",
  location: "",
  locationData: null,
  eventImages: [],
  tags: [],
  eventDate: new Date().toISOString(),
  endDate: null,
  ticketPrice: "",
  maxAttendees: "",
  youtubeUrl: "",
  ticketingEnabled: false,
  visibility: "public",
  ageRestriction: "none",
  isOnline: false,
  dressCode: "",
  doorPolicy: "",
  lineup: [],
  perks: [],
  ticketTiers: [],
};

const UI_DEFAULTS: UIFields = {
  showDatePicker: false,
  showTimePicker: false,
  showEndDatePicker: false,
  showEndTimePicker: false,
  isSubmitting: false,
  uploadProgress: 0,
  customTag: "",
  lineupInput: "",
  perksInput: "",
  ticketTierName: "",
};

// Helper to resolve functional updaters
function resolve<T>(v: T | ((prev: T) => T), prev: T): T {
  return typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
}

export const useCreateEventStore = create<CreateEventState>()(
  persist(
    (set, get) => ({
      ...DRAFT_DEFAULTS,
      ...UI_DEFAULTS,

      // Draft field setters
      setTitle: (v) => set({ title: v }),
      setDescription: (v) => set({ description: v }),
      setLocation: (v) => set({ location: v }),
      setLocationData: (v) =>
        set({ locationData: v, location: v?.name || get().location }),
      setEventImages: (v) =>
        set((s) => ({ eventImages: resolve(v, s.eventImages) })),
      setTags: (v) => set((s) => ({ tags: resolve(v, s.tags) })),
      setEventDate: (v) => set({ eventDate: v }),
      setEndDate: (v) => set({ endDate: v }),
      setTicketPrice: (v) => set({ ticketPrice: v }),
      setMaxAttendees: (v) => set({ maxAttendees: v }),
      setYoutubeUrl: (v) => set({ youtubeUrl: v }),
      setTicketingEnabled: (v) => set({ ticketingEnabled: v }),
      setVisibility: (v) => set({ visibility: v }),
      setAgeRestriction: (v) => set({ ageRestriction: v }),
      setIsOnline: (v) => set({ isOnline: v }),
      setDressCode: (v) => set({ dressCode: v }),
      setDoorPolicy: (v) => set({ doorPolicy: v }),
      setLineup: (v) => set((s) => ({ lineup: resolve(v, s.lineup) })),
      setPerks: (v) => set((s) => ({ perks: resolve(v, s.perks) })),
      setTicketTiers: (v) =>
        set((s) => ({ ticketTiers: resolve(v, s.ticketTiers) })),

      // UI-only setters
      setShowDatePicker: (v) => set({ showDatePicker: v }),
      setShowTimePicker: (v) => set({ showTimePicker: v }),
      setShowEndDatePicker: (v) => set({ showEndDatePicker: v }),
      setShowEndTimePicker: (v) => set({ showEndTimePicker: v }),
      setIsSubmitting: (v) => set({ isSubmitting: v }),
      setUploadProgress: (v) => set({ uploadProgress: v }),
      setCustomTag: (v) => set({ customTag: v }),
      setLineupInput: (v) => set({ lineupInput: v }),
      setPerksInput: (v) => set({ perksInput: v }),
      setTicketTierName: (v) => set({ ticketTierName: v }),

      // Helpers
      toggleTag: (tag) =>
        set((s) => ({
          tags: s.tags.includes(tag)
            ? s.tags.filter((t) => t !== tag)
            : [...s.tags, tag],
        })),

      addCustomTag: () => {
        const trimmed = get().customTag.trim().toLowerCase();
        if (trimmed && !get().tags.includes(trimmed)) {
          set((s) => ({ tags: [...s.tags, trimmed], customTag: "" }));
        }
      },

      addLineupItem: () => {
        const trimmed = get().lineupInput.trim();
        if (trimmed) {
          set((s) => ({ lineup: [...s.lineup, trimmed], lineupInput: "" }));
        }
      },

      addPerk: () => {
        const trimmed = get().perksInput.trim();
        if (trimmed) {
          set((s) => ({ perks: [...s.perks, trimmed], perksInput: "" }));
        }
      },

      hasDraft: () => {
        const s = get();
        return !!(s.title.trim() || s.description.trim() || s.eventImages.length > 0);
      },

      resetDraft: () => set({ ...DRAFT_DEFAULTS, ...UI_DEFAULTS }),
    }),
    {
      name: "create-event-draft",
      storage: mmkvStorage,
      // Only persist draft fields, not UI-only state
      partialize: (state) => ({
        title: state.title,
        description: state.description,
        location: state.location,
        locationData: state.locationData,
        eventImages: state.eventImages,
        tags: state.tags,
        eventDate: state.eventDate,
        endDate: state.endDate,
        ticketPrice: state.ticketPrice,
        maxAttendees: state.maxAttendees,
        youtubeUrl: state.youtubeUrl,
        ticketingEnabled: state.ticketingEnabled,
        visibility: state.visibility,
        ageRestriction: state.ageRestriction,
        isOnline: state.isOnline,
        dressCode: state.dressCode,
        doorPolicy: state.doorPolicy,
        lineup: state.lineup,
        perks: state.perks,
        ticketTiers: state.ticketTiers,
      }),
    },
  ),
);
