import { create } from "zustand";
import type {
  CampaignPlacement,
  PromotionDuration,
} from "@/src/events/promotion-types";

interface PromotionSheetState {
  // Bottom sheet visibility
  visible: boolean;
  eventId: string | null;
  eventTitle: string | null;

  // Form state
  selectedDuration: PromotionDuration;
  selectedPlacement: CampaignPlacement;
  startNow: boolean;
  isCheckingOut: boolean;

  // Actions
  openSheet: (eventId: string, eventTitle: string) => void;
  closeSheet: () => void;
  setDuration: (d: PromotionDuration) => void;
  setPlacement: (p: CampaignPlacement) => void;
  setStartNow: (v: boolean) => void;
  setCheckingOut: (v: boolean) => void;
}

export const usePromotionStore = create<PromotionSheetState>((set) => ({
  visible: false,
  eventId: null,
  eventTitle: null,

  selectedDuration: "7d",
  selectedPlacement: "spotlight+feed",
  startNow: true,
  isCheckingOut: false,

  openSheet: (eventId, eventTitle) =>
    set({
      visible: true,
      eventId,
      eventTitle,
      selectedDuration: "7d",
      selectedPlacement: "spotlight+feed",
      startNow: true,
      isCheckingOut: false,
    }),

  closeSheet: () =>
    set({
      visible: false,
      eventId: null,
      eventTitle: null,
      isCheckingOut: false,
    }),

  setDuration: (d) => set({ selectedDuration: d }),
  setPlacement: (p) => set({ selectedPlacement: p }),
  setStartNow: (v) => set({ startNow: v }),
  setCheckingOut: (v) => set({ isCheckingOut: v }),
}));
