/**
 * Live Surface Zustand Store
 * Manages the LiveSurfacePayload state and native surface lifecycle.
 */

import { create } from "zustand";
import type { LiveSurfacePayload } from "./types";

interface LiveSurfaceState {
  payload: LiveSurfacePayload | null;
  isActive: boolean;
  currentTile: number;
  lastFetchedAt: number;
  error: string | null;

  setPayload: (payload: LiveSurfacePayload) => void;
  setActive: (active: boolean) => void;
  setCurrentTile: (tile: number) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useLiveSurfaceStore = create<LiveSurfaceState>((set) => ({
  payload: null,
  isActive: false,
  currentTile: 0,
  lastFetchedAt: 0,
  error: null,

  setPayload: (payload) =>
    set({ payload, lastFetchedAt: Date.now(), error: null }),

  setActive: (isActive) => set({ isActive }),

  setCurrentTile: (currentTile) =>
    set({ currentTile: Math.max(0, Math.min(2, currentTile)) }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      payload: null,
      isActive: false,
      currentTile: 0,
      lastFetchedAt: 0,
      error: null,
    }),
}));
