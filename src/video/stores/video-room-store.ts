/**
 * Video Room Store (Zustand)
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ALL video room + call state lives here — NOT in useState.         ║
 * ║  The useVideoRoom / useVideoCall hooks read/write via this store.  ║
 * ║  Components subscribe to individual slices for minimal re-renders. ║
 * ║                                                                    ║
 * ║  INVARIANT: No component may use useState for:                     ║
 * ║    room, participants, tracks, call status, permissions, media.    ║
 * ║  Derived state must use Zustand selectors.                         ║
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

// ── Call lifecycle phases (strict state machine) ─────────────────────

export type CallPhase =
  | "idle" // No call in progress
  | "requesting_perms" // Awaiting camera/mic OS permissions
  | "perms_denied" // User denied permissions — blocked
  | "creating_room" // Edge function: create room
  | "joining_room" // Edge function: join room + get token
  | "connecting_peer" // Fishjam: connecting WebRTC peer
  | "starting_media" // Starting camera/mic tracks
  | "connected" // Fully connected, media flowing
  | "reconnecting" // Temporary disconnect, auto-recovering
  | "call_ended" // Call ended — show summary UI
  | "error"; // Unrecoverable error — show error UI

export type CallType = "audio" | "video";

export type PermissionState = "pending" | "granted" | "denied";

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
  roomId: string | null;
  localUser: LocalUser | null;
  participants: Participant[];

  // Connection
  connectionState: ConnectionState;

  // Call lifecycle
  callPhase: CallPhase;
  callType: CallType;
  chatId: string | null;
  callEnded: boolean;
  callDuration: number;
  callStartedAt: number | null;

  // Permissions
  cameraPermission: PermissionState;
  micPermission: PermissionState;

  // Media
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  localStream: MediaStream | null;

  // Error
  error: string | null;
  errorCode: string | null;

  // Eject
  isEjected: boolean;
  ejectReason?: EjectPayload;
}

interface VideoRoomStoreActions {
  // Room
  setRoom: (room: VideoRoom | null) => void;
  setRoomId: (roomId: string | null) => void;
  setLocalUser: (user: LocalUser | null) => void;
  setParticipants: (participants: Participant[]) => void;

  // Connection — bails out if status unchanged
  setConnectionStatus: (
    status: ConnectionState["status"],
    error?: string,
  ) => void;

  // Call lifecycle
  setCallPhase: (phase: CallPhase) => void;
  setCallType: (type: CallType) => void;
  setChatId: (chatId: string | null) => void;
  setCallEnded: (duration: number) => void;
  setCallDuration: (duration: number) => void;
  setCallStartedAt: (ts: number | null) => void;

  // Permissions
  setCameraPermission: (state: PermissionState) => void;
  setMicPermission: (state: PermissionState) => void;

  // Media
  setCameraOn: (on: boolean) => void;
  setMicOn: (on: boolean) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  toggleFrontCamera: () => void;
  setLocalStream: (stream: MediaStream | null) => void;

  // Escalation (audio → video)
  escalateToVideo: () => void;

  // Error
  setError: (message: string, code?: string) => void;
  clearError: () => void;

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
  roomId: null,
  localUser: null,
  participants: [],
  connectionState: { status: "disconnected" },
  callPhase: "idle",
  callType: "video",
  chatId: null,
  callEnded: false,
  callDuration: 0,
  callStartedAt: null,
  cameraPermission: "pending",
  micPermission: "pending",
  isCameraOn: false,
  isMicOn: false,
  isFrontCamera: true,
  localStream: null,
  error: null,
  errorCode: null,
  isEjected: false,
  ejectReason: undefined,
};

// ── Store ────────────────────────────────────────────────────────────

export const useVideoRoomStore = create<VideoRoomStore>((set, get) => ({
  ...initialState,

  setRoom: (room) => set({ room }),
  setRoomId: (roomId) => set({ roomId }),

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

  // Call lifecycle
  setCallPhase: (callPhase) => {
    const prev = get().callPhase;
    if (prev === callPhase) return;
    console.log(`[VideoStore] Phase: ${prev} → ${callPhase}`);
    set({ callPhase });
  },
  setCallType: (callType) => set({ callType }),
  setChatId: (chatId) => set({ chatId }),
  setCallEnded: (duration) =>
    set({
      callPhase: "call_ended",
      callEnded: true,
      callDuration: duration,
      localStream: null,
      participants: [],
    }),
  setCallDuration: (callDuration) => set({ callDuration }),
  setCallStartedAt: (callStartedAt) => set({ callStartedAt }),

  // Permissions
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),
  setMicPermission: (micPermission) => set({ micPermission }),

  // Media — with audio-mode guard
  setCameraOn: (isCameraOn) => {
    const { callType } = get();
    if (isCameraOn && callType === "audio") {
      console.error(
        "[VideoStore] INVARIANT VIOLATION: setCameraOn(true) called in audio mode. " +
          "Camera MUST NOT be enabled during audio calls. Use escalateToVideo() first.",
      );
      return; // Block — do NOT enable camera in audio mode
    }
    set({ isCameraOn });
  },
  setMicOn: (isMicOn) => set({ isMicOn }),
  toggleCamera: () => {
    const { callType, isCameraOn } = get();
    if (!isCameraOn && callType === "audio") {
      console.error(
        "[VideoStore] INVARIANT VIOLATION: toggleCamera() in audio mode. " +
          "Use escalateToVideo() to upgrade call first.",
      );
      return;
    }
    set({ isCameraOn: !isCameraOn });
  },
  toggleMic: () => set((s) => ({ isMicOn: !s.isMicOn })),
  toggleFrontCamera: () => set((s) => ({ isFrontCamera: !s.isFrontCamera })),
  setLocalStream: (localStream) => set({ localStream }),

  // Escalation (audio → video) — explicit mode transition
  escalateToVideo: () => {
    const prev = get();
    if (prev.callType === "video") return; // already video
    console.log("[VideoStore] Escalating call: audio → video");
    set({ callType: "video" });
  },

  // Error
  setError: (message, code) => {
    console.error(`[VideoStore] ERROR [${code || "unknown"}]: ${message}`);
    set({ error: message, errorCode: code || null, callPhase: "error" });
  },
  clearError: () => set({ error: null, errorCode: null }),

  setEjected: (ejectReason) => {
    if (get().isEjected) return; // already ejected, bail
    set({
      isEjected: true,
      ejectReason,
      connectionState: { status: "disconnected" },
      callPhase: "call_ended",
    });
  },

  setRoomEnded: () => {
    const prev = get();
    set({
      room: prev.room ? { ...prev.room, status: "ended" } : null,
      connectionState: { status: "disconnected" },
      callPhase: "call_ended",
    });
  },

  reset: () => set(initialState),
}));
