/**
 * Sneaky Lynk Room Store
 * Manages room state using Zustand instead of useState
 */

import { create } from "zustand";
import type { EjectPayload } from "../types";

interface RoomState {
  // Connection state
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  
  // Local controls
  isMuted: boolean;
  isVideoOn: boolean;
  isHandRaised: boolean;
  
  // Active speaker
  activeSpeakerId: string | null;
  
  // Modals
  showEjectModal: boolean;
  ejectPayload: EjectPayload | null;
  
  // Actions
  setConnectionState: (state: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setIsVideoOn: (on: boolean) => void;
  toggleVideo: () => void;
  setIsHandRaised: (raised: boolean) => void;
  toggleHand: () => void;
  setActiveSpeakerId: (id: string | null) => void;
  showEject: (payload: EjectPayload) => void;
  hideEject: () => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  connectionState: "connected" as const,
  isMuted: true,
  isVideoOn: false,
  isHandRaised: false,
  activeSpeakerId: null,
  showEjectModal: false,
  ejectPayload: null,
};

export const useRoomStore = create<RoomState>((set) => ({
  ...initialState,

  setConnectionState: (connectionState) => set({ connectionState }),
  
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  
  setIsVideoOn: (isVideoOn) => set({ isVideoOn }),
  toggleVideo: () => set((state) => ({ isVideoOn: !state.isVideoOn })),
  
  setIsHandRaised: (isHandRaised) => set({ isHandRaised }),
  toggleHand: () => set((state) => ({ isHandRaised: !state.isHandRaised })),
  
  setActiveSpeakerId: (activeSpeakerId) => set({ activeSpeakerId }),
  
  showEject: (ejectPayload) => set({ showEjectModal: true, ejectPayload }),
  hideEject: () => set({ showEjectModal: false, ejectPayload: null }),
  
  reset: () => set(initialState),
}));
