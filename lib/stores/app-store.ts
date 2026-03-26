import { create } from "zustand";
import { mmkv } from "@/lib/mmkv-zustand";

const NSFW_STORAGE_KEY = "app_nsfw_enabled";
const FEED_MODE_KEY = "app_feed_mode";

// Module-level flag to ensure splash NEVER replays within app process lifetime
let splashHasFinishedEver = false;

export type FeedMode = "classic" | "masonry";
export interface PendingAppRoute {
  pathname: string;
  params?: Record<string, string>;
}

function readPersistedNsfwEnabled(): boolean {
  try {
    const stored = mmkv.getString(NSFW_STORAGE_KEY) ?? null;
    return stored !== null ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
}

interface AppState {
  appReady: boolean;
  splashAnimationFinished: boolean;
  nsfwEnabled: boolean;
  nsfwLoaded: boolean;
  feedMode: FeedMode;
  /** Route to navigate to after splash + auth settle (from notification cold start) */
  pendingNotificationRoute: string | null;
  /** Route to navigate to after splash + auth settle (from share intent cold start) */
  pendingShareIntentRoute: PendingAppRoute | null;
  setAppReady: (ready: boolean) => void;
  setSplashAnimationFinished: (finished: boolean) => void;
  onAnimationFinish: (isCancelled: boolean) => void;
  setNsfwEnabled: (enabled: boolean) => void;
  toggleNsfwEnabled: () => boolean;
  setFeedMode: (mode: FeedMode) => void;
  loadNsfwSetting: () => void;
  setPendingNotificationRoute: (route: string | null) => void;
  consumePendingNotificationRoute: () => string | null;
  setPendingShareIntentRoute: (route: PendingAppRoute | null) => void;
  consumePendingShareIntentRoute: () => PendingAppRoute | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  appReady: false,
  // Initialize from module-level flag to handle any store resets
  splashAnimationFinished: splashHasFinishedEver,
  nsfwEnabled: readPersistedNsfwEnabled(),
  nsfwLoaded: true,
  feedMode: ((): FeedMode => {
    try {
      const stored = mmkv.getString(FEED_MODE_KEY) as FeedMode | undefined;
      // Default to masonry — clear any stale "classic" persisted value
      if (!stored || stored === "classic") {
        mmkv.set(FEED_MODE_KEY, "masonry");
        return "masonry";
      }
      return stored;
    } catch {
      return "masonry";
    }
  })(),
  pendingNotificationRoute: null,
  pendingShareIntentRoute: null,
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
  setPendingShareIntentRoute: (route) => set({ pendingShareIntentRoute: route }),
  consumePendingShareIntentRoute: () => {
    const route = get().pendingShareIntentRoute;
    if (route) set({ pendingShareIntentRoute: null });
    return route;
  },
  setNsfwEnabled: (enabled) => {
    set({ nsfwEnabled: enabled, nsfwLoaded: true });
    try {
      mmkv.set(NSFW_STORAGE_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.log("Error saving NSFW setting:", error);
    }
  },
  toggleNsfwEnabled: () => {
    const nextEnabled = !get().nsfwEnabled;
    get().setNsfwEnabled(nextEnabled);
    return nextEnabled;
  },
  setFeedMode: (mode) => {
    set({ feedMode: mode });
    try {
      mmkv.set(FEED_MODE_KEY, mode);
    } catch (error) {
      console.log("Error saving feed mode:", error);
    }
  },
  loadNsfwSetting: () => {
    try {
      const nextEnabled = readPersistedNsfwEnabled();
      const { nsfwEnabled, nsfwLoaded } = get();

      if (nsfwLoaded && nsfwEnabled === nextEnabled) {
        return;
      }

      set({ nsfwEnabled: nextEnabled, nsfwLoaded: true });
    } catch (error) {
      console.log("Error loading NSFW setting:", error);
      set({ nsfwLoaded: true });
    }
  },
}));
