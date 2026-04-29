/**
 * Event Detail Screen Store
 *
 * Zustand store for event detail screen ephemeral UI state.
 * Replaces useState calls to comply with project mandate.
 */

import { create } from "zustand";
import type { TicketTier } from "@/src/events/types";

interface EventDetailScreenState {
  selectedTier: TicketTier | null;
  showRatingModal: boolean;
  showAttendeesModal: boolean;
  isLiked: boolean;
  isCheckingOut: boolean;
  promoCode: string;
  ticketQty: number;
  // Feature: expandable attendees grid
  attendeesExpanded: boolean;
  // Feature: Who All Over There
  showMomentUploader: boolean;
  momentViewerIndex: number; // -1 = closed
  uploadingMoment: boolean;

  setSelectedTier: (tier: TicketTier | null) => void;
  setShowRatingModal: (show: boolean) => void;
  setShowAttendeesModal: (show: boolean) => void;
  setIsLiked: (liked: boolean) => void;
  setIsCheckingOut: (checking: boolean) => void;
  setPromoCode: (code: string) => void;
  setTicketQty: (qty: number) => void;
  setAttendeesExpanded: (expanded: boolean) => void;
  setShowMomentUploader: (show: boolean) => void;
  setMomentViewerIndex: (index: number) => void;
  setUploadingMoment: (uploading: boolean) => void;
  resetEventDetailScreen: () => void;
}

const initialState = {
  selectedTier: null,
  showRatingModal: false,
  showAttendeesModal: false,
  isLiked: false,
  isCheckingOut: false,
  promoCode: "",
  ticketQty: 1,
  attendeesExpanded: false,
  showMomentUploader: false,
  momentViewerIndex: -1,
  uploadingMoment: false,
};

export const useEventDetailScreenStore = create<EventDetailScreenState>(
  (set) => ({
    ...initialState,

    setSelectedTier: (tier) => set({ selectedTier: tier }),
    setShowRatingModal: (show) => set({ showRatingModal: show }),
    setShowAttendeesModal: (show) => set({ showAttendeesModal: show }),
    setIsLiked: (liked) => set({ isLiked: liked }),
    setIsCheckingOut: (checking) => set({ isCheckingOut: checking }),
    setPromoCode: (code) => set({ promoCode: code }),
    setTicketQty: (qty) => set({ ticketQty: Math.max(1, qty) }),
    setAttendeesExpanded: (expanded) => set({ attendeesExpanded: expanded }),
    setShowMomentUploader: (show) => set({ showMomentUploader: show }),
    setMomentViewerIndex: (index) => set({ momentViewerIndex: index }),
    setUploadingMoment: (uploading) => set({ uploadingMoment: uploading }),

    resetEventDetailScreen: () => set(initialState),
  }),
);
