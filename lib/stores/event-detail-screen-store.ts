/**
 * Event Detail Screen Store
 *
 * Zustand store for event detail screen ephemeral UI state.
 * Replaces useState calls to comply with project mandate.
 */

import { create } from "zustand";
import type { TicketTier } from "@/src/events/types";

interface EventDetailScreenState {
  // Ticket selection state
  selectedTier: TicketTier | null;

  // Modal state
  showRatingModal: boolean;

  // Like state (local optimistic)
  isLiked: boolean;

  // Checkout state
  isCheckingOut: boolean;
  promoCode: string;

  // Actions
  setSelectedTier: (tier: TicketTier | null) => void;
  setShowRatingModal: (show: boolean) => void;
  setIsLiked: (liked: boolean) => void;
  setIsCheckingOut: (checking: boolean) => void;
  setPromoCode: (code: string) => void;

  // Reset all state when leaving screen
  resetEventDetailScreen: () => void;
}

const initialState = {
  selectedTier: null,
  showRatingModal: false,
  isLiked: false,
  isCheckingOut: false,
  promoCode: "",
};

export const useEventDetailScreenStore = create<EventDetailScreenState>(
  (set) => ({
    ...initialState,

    setSelectedTier: (tier) => set({ selectedTier: tier }),

    setShowRatingModal: (show) => set({ showRatingModal: show }),

    setIsLiked: (liked) => set({ isLiked: liked }),

    setIsCheckingOut: (checking) => set({ isCheckingOut: checking }),

    setPromoCode: (code) => set({ promoCode: code }),

    resetEventDetailScreen: () => set(initialState),
  }),
);
