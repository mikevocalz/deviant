/**
 * Lynk History Store
 * Persists Sneaky Lynk rooms locally so ended rooms show on the Lynks tab.
 * Uses Zustand with MMKV for persistence across app restarts.
 */

import { create } from "zustand";
import type { SneakyUser } from "../types";

export interface LynkRecord {
  id: string;
  title: string;
  topic: string;
  description: string;
  isLive: boolean;
  hasVideo: boolean;
  isPublic: boolean;
  status: "open" | "ended";
  host: SneakyUser;
  speakers: SneakyUser[];
  listeners: number;
  createdAt: string;
  endedAt?: string;
}

interface LynkHistoryState {
  rooms: LynkRecord[];

  // Actions
  addRoom: (room: LynkRecord) => void;
  endRoom: (roomId: string, listenerCount?: number) => void;
  updateListeners: (roomId: string, count: number) => void;
  removeRoom: (roomId: string) => void;
  clearAll: () => void;
}

export const useLynkHistoryStore = create<LynkHistoryState>((set) => ({
  rooms: [],

  addRoom: (room) =>
    set((state) => {
      // Don't add duplicates
      if (state.rooms.some((r) => r.id === room.id)) return state;
      return { rooms: [room, ...state.rooms] };
    }),

  endRoom: (roomId, listenerCount) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              isLive: false,
              status: "ended" as const,
              endedAt: new Date().toISOString(),
              listeners: listenerCount ?? r.listeners,
            }
          : r,
      ),
    })),

  updateListeners: (roomId, count) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, listeners: count } : r,
      ),
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
    })),

  clearAll: () => set({ rooms: [] }),
}));
