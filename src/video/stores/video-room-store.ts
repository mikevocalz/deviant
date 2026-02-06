/**
 * Video Room Store (Zustand)
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ALL video room state lives here — NOT in useState.                ║
 * ║  The useVideoRoom hook reads/writes via this store.                ║
 * ║  Components subscribe to individual slices for minimal re-renders. ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import type {
  VideoRoom,
  Participant,
  ConnectionState,
  EjectPayload,
  MemberRole,
} from "../types";

// ── State shape ──────────────────────────────────────────────────────

interface LocalUser {
  id: string;
  username?: string;
  avatar?: string;
  role: MemberRole;
  peerId?: string;
}

interface VideoRoomStoreState {
  // Room data
  room: VideoRoom | null;
  localUser: LocalUser | null;
  participants: Participant[];

  // Connection
  connectionState: ConnectionState;

  // Media
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;

  // Eject
  isEjected: boolean;
  ejectReason?: EjectPayload;
}

interface VideoRoomStoreActions {
  // Room
  setRoom: (room: VideoRoom | null) => void;
  setLocalUser: (user: LocalUser | null) => void;
  setParticipants: (participants: Participant[]) => void;

  // Connection — bails out if status unchanged
  setConnectionStatus: (status: ConnectionState["status"], error?: string) => void;

  // Media
  toggleCamera: () => void;
  toggleMic: () => void;
  toggleFrontCamera: () => void;

  // Eject
  setEjected: (payload: EjectPayload) => void;
  setRoomEnded: () => void;

  // Reset
  reset: () => void;
}

export type VideoRoomStore = VideoRoomStoreState & VideoRoomStoreActions;

// ── Initial state ────────────────────────────────────────────────────

const initialState: VideoRoomStoreState = {
  room: null,
  localUser: null,
  participants: [],
  connectionState: { status: "disconnected" },
  isCameraOn: false,
  isMicOn: false,
  isFrontCamera: true,
  isEjected: false,
  ejectReason: undefined,
};

// ── Store ────────────────────────────────────────────────────────────

export const useVideoRoomStore = create<VideoRoomStore>((set, get) => ({
  ...initialState,

  setRoom: (room) => set({ room }),

  setLocalUser: (localUser) => set({ localUser }),

  setParticipants: (participants) => {
    const prev = get().participants;
    // Bail out if same users with same track states
    if (
      prev.length === participants.length &&
      prev.every(
        (p, i) =>
          p.userId === participants[i]?.userId &&
          p.isCameraOn === participants[i]?.isCameraOn &&
          p.isMicOn === participants[i]?.isMicOn,
      )
    ) {
      return; // no-op, prevents unnecessary re-renders
    }
    set({ participants });
  },

  setConnectionStatus: (status, error) => {
    const prev = get().connectionState;
    if (prev.status === status && prev.error === error) return; // bail out
    set({ connectionState: { status, error } });
  },

  toggleCamera: () => set((s) => ({ isCameraOn: !s.isCameraOn })),
  toggleMic: () => set((s) => ({ isMicOn: !s.isMicOn })),
  toggleFrontCamera: () => set((s) => ({ isFrontCamera: !s.isFrontCamera })),

  setEjected: (ejectReason) => {
    if (get().isEjected) return; // already ejected, bail
    set({
      isEjected: true,
      ejectReason,
      connectionState: { status: "disconnected" },
    });
  },

  setRoomEnded: () => {
    const prev = get();
    set({
      room: prev.room ? { ...prev.room, status: "ended" } : null,
      connectionState: { status: "disconnected" },
    });
  },

  reset: () => set(initialState),
}));
