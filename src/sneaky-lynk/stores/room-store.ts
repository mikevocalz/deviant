/**
 * Sneaky Lynk Room Store
 * Manages room state using Zustand instead of useState
 */

import { create } from "zustand";
import type { EjectPayload, SneakyUser } from "../types";

interface RoomMember {
  user: SneakyUser;
  role: "host" | "co-host" | "speaker" | "listener";
  hasVideo?: boolean;
}

interface RoomState {
  // Connection state
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";

  // Local controls
  isMuted: boolean;
  isVideoOn: boolean;
  isHandRaised: boolean;

  // Active speaker
  activeSpeakerId: string | null;

  // Co-host (optimistic — shows immediately in dual view)
  coHost: RoomMember | null;

  // Listeners (optimistic — appear instantly when they join)
  listeners: RoomMember[];

  // Chat
  isChatOpen: boolean;

  // Modals
  showEjectModal: boolean;
  ejectPayload: EjectPayload | null;

  // Actions
  setConnectionState: (
    state: "connecting" | "connected" | "reconnecting" | "disconnected",
  ) => void;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setIsVideoOn: (on: boolean) => void;
  toggleVideo: () => void;
  setIsHandRaised: (raised: boolean) => void;
  toggleHand: () => void;
  setActiveSpeakerId: (id: string | null) => void;
  openChat: () => void;
  closeChat: () => void;
  showEject: (payload: EjectPayload) => void;
  hideEject: () => void;

  // Co-host (optimistic)
  setCoHost: (user: SneakyUser) => void;
  removeCoHost: () => void;

  // Listeners (optimistic)
  addListener: (user: SneakyUser) => void;
  removeListener: (userId: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  connectionState: "connected" as const,
  isMuted: true,
  isVideoOn: false,
  isHandRaised: false,
  activeSpeakerId: null,
  coHost: null as RoomMember | null,
  listeners: [] as RoomMember[],
  isChatOpen: false,
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

  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),

  showEject: (ejectPayload) => set({ showEjectModal: true, ejectPayload }),
  hideEject: () => set({ showEjectModal: false, ejectPayload: null }),

  // Co-host — optimistic: appears in dual view immediately
  setCoHost: (user) =>
    set({ coHost: { user, role: "co-host", hasVideo: false } }),
  removeCoHost: () => set({ coHost: null }),

  // Listeners — optimistic: appear in listener grid immediately
  addListener: (user) =>
    set((state) => {
      if (state.listeners.some((l) => l.user.id === user.id)) return state;
      return { listeners: [...state.listeners, { user, role: "listener" }] };
    }),
  removeListener: (userId) =>
    set((state) => ({
      listeners: state.listeners.filter((l) => l.user.id !== userId),
    })),

  reset: () => set(initialState),
}));
