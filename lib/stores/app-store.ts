import { create } from "zustand";
import { mmkv } from "@/lib/mmkv-zustand";

const NSFW_STORAGE_KEY = "app_nsfw_enabled";

// Module-level flag to ensure splash NEVER replays within app process lifetime
let splashHasFinishedEver = false;

interface AppState {
  appReady: boolean;
  splashAnimationFinished: boolean;
  nsfwEnabled: boolean;
  nsfwLoaded: boolean;
  /** Route to navigate to after splash + auth settle (from notification cold start) */
  pendingNotificationRoute: string | null;
  setAppReady: (ready: boolean) => void;
  setSplashAnimationFinished: (finished: boolean) => void;
  onAnimationFinish: (isCancelled: boolean) => void;
  setNsfwEnabled: (enabled: boolean) => void;
  loadNsfwSetting: () => Promise<void>;
  setPendingNotificationRoute: (route: string | null) => void;
  consumePendingNotificationRoute: () => string | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  appReady: false,
  // Initialize from module-level flag to handle any store resets
  splashAnimationFinished: splashHasFinishedEver,
  nsfwEnabled: false,
  nsfwLoaded: false,
  pendingNotificationRoute: null,
  setAppReady: (ready) => set({ appReady: ready }),
  setSplashAnimationFinished: (finished) => {
    if (finished) {
      splashHasFinishedEver = true;
    }
    set({ splashAnimationFinished: finished });
  },
  onAnimationFinish: (isCancelled) => {
    // Guard: Never call this more than once
    if (splashHasFinishedEver || get().splashAnimationFinished) {
      console.log(
        "[AppStore] onAnimationFinish called but splash already finished, ignoring",
      );
      return;
    }

    console.log(
      "[AppStore] onAnimationFinish called, isCancelled:",
      isCancelled,
    );
    if (!isCancelled) {
      console.log("[AppStore] Setting splashAnimationFinished to true");
      splashHasFinishedEver = true;
      set({ splashAnimationFinished: true });
      console.log("[AppStore] splashAnimationFinished set to true (permanent)");
    } else {
      console.log("[AppStore] Animation was cancelled, not finishing");
    }
  },
  setPendingNotificationRoute: (route) =>
    set({ pendingNotificationRoute: route }),
  consumePendingNotificationRoute: () => {
    const route = get().pendingNotificationRoute;
    if (route) set({ pendingNotificationRoute: null });
    return route;
  },
  setNsfwEnabled: (enabled) => {
    set({ nsfwEnabled: enabled });
    try {
      mmkv.set(NSFW_STORAGE_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.log("Error saving NSFW setting:", error);
    }
  },
  loadNsfwSetting: async () => {
    try {
      const stored = mmkv.getString(NSFW_STORAGE_KEY) ?? null;
      if (stored !== null) {
        set({ nsfwEnabled: JSON.parse(stored), nsfwLoaded: true });
      } else {
        set({ nsfwLoaded: true });
      }
    } catch (error) {
      console.log("Error loading NSFW setting:", error);
      set({ nsfwLoaded: true });
    }
  },
}));
