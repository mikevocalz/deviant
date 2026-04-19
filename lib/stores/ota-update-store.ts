import { create } from "zustand";
import { mmkv } from "@/lib/mmkv-zustand";

export type OtaPhase = "idle" | "visible" | "dismissed" | "applying";

// MMKV key shared with use-updates for cross-session dedup
export const OTA_DISMISSED_STORAGE_KEY = "@dvnt_dismissed_update_id";

interface OtaUpdateState {
  phase: OtaPhase;
  updateId: string | null;
  setUpdateId: (id: string | null) => void;
  showBanner: () => void;
  dismiss: () => void;
  apply: () => void;
}

export const useOtaUpdateStore = create<OtaUpdateState>((set, get) => ({
  phase: "idle",
  updateId: null,

  setUpdateId: (id) => set({ updateId: id }),

  // Only idle → visible (prevents duplicate banners within a session)
  showBanner: () => {
    if (get().phase === "idle") set({ phase: "visible" });
  },

  dismiss: () => {
    const { updateId } = get();
    if (updateId) {
      try {
        mmkv.set(OTA_DISMISSED_STORAGE_KEY, updateId);
      } catch {}
    }
    set({ phase: "dismissed" });
  },

  apply: () => {
    try {
      mmkv.remove(OTA_DISMISSED_STORAGE_KEY);
    } catch {}
    set({ phase: "applying" });
  },
}));
