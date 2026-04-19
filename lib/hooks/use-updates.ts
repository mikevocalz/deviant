/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates.
 * CRITICAL: This hook must NEVER crash the app. All operations are wrapped
 * in try-catch blocks and failures are logged.
 *
 * DEDUPLICATION: Uses persistent storage to track which update IDs have been
 * shown/dismissed to prevent toast spam across app restarts.
 *
 * OTA PROMPT: Uses OtaUpdateBanner (Zustand-controlled) — NOT sonner-native.
 * This eliminates the ghost/stale overlay bug where sonner toasts would linger
 * on-screen after "Update Later" was tapped.
 *
 * To test OTA in development builds: set EXPO_PUBLIC_FORCE_OTA_CHECK=true.
 * Publish updates with: eas update --channel production
 */

import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { mmkv } from "@/lib/mmkv-zustand";
import {
  useOtaUpdateStore,
  OTA_DISMISSED_STORAGE_KEY,
} from "@/lib/stores/ota-update-store";

const FORCE_OTA_IN_DEV =
  typeof process !== "undefined" &&
  process.env?.EXPO_PUBLIC_FORCE_OTA_CHECK === "true";

// SINGLETON: Module-level flags to prevent multiple hook instances from racing
let globalIsInitialized = false;
let globalIsChecking = false;

// Dynamically import expo-updates to handle Expo Go where native module isn't available
let Updates: typeof import("expo-updates") | null = null;
let UpdatesAvailable = false;

try {
  if (Platform.OS !== "web") {
    Updates = require("expo-updates");
    UpdatesAvailable = true;
  }
} catch (error) {
  console.log("[Updates] expo-updates not available (Expo Go / web)");
}

// Safe property access helper
function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * showUpdateBanner — imperative (non-hook) helper.
 * Uses Zustand's getState() so it can be called from inside callbacks without
 * being a useCallback dependency or causing stale-closure issues.
 *
 * Guards:
 *  1. Phase must be "idle" — prevents duplicates within a session
 *  2. MMKV dismissed-ID check — prevents loops across cold restarts
 */
function showUpdateBanner(updateId?: string | null) {
  const store = useOtaUpdateStore.getState();

  // Guard 1: already shown or dismissed this session
  if (store.phase !== "idle") {
    console.log("[Updates] Banner suppressed — phase:", store.phase);
    return;
  }

  const currentId = updateId ?? null;

  // Guard 2: user already dismissed THIS exact update ID on a prior session
  if (currentId) {
    const dismissedId = safeGet(
      () => mmkv.getString(OTA_DISMISSED_STORAGE_KEY),
      null,
    );
    if (dismissedId === currentId) {
      console.log(
        "[Updates] Banner suppressed — already dismissed ID:",
        currentId,
      );
      return;
    }
  }

  store.setUpdateId(currentId);
  store.showBanner();
  console.log("[Updates] Banner shown for ID:", currentId);
}

export interface UpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  error: string | null;
}

export interface UseUpdatesOptions {
  /** If false, OTA checks will be deferred until enabled becomes true */
  enabled?: boolean;
}

export function useUpdates(options: UseUpdatesOptions = {}) {
  const { enabled = true } = options;

  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  useEffect(() => {
    console.log(
      "[Updates] Hook mounted — __DEV__:",
      __DEV__,
      "FORCE_OTA:",
      FORCE_OTA_IN_DEV,
      "UpdatesAvailable:",
      UpdatesAvailable,
      "globalInitialized:",
      globalIsInitialized,
      "enabled:",
      enabled,
    );
    if (Updates) {
      console.log(
        "[Updates] expo-updates loaded, isEnabled:",
        safeGet(() => Updates?.isEnabled, false),
      );
    }
  }, [enabled]);

  const reloadApp = useCallback(async () => {
    if (!Updates) return;
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.warn(
        "[Updates] reloadAsync failed (update applies on next cold start):",
        e,
      );
    }
  }, []);

  const downloadAndApplyUpdate = useCallback(async () => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev)
        console.log(
          "[Updates] Skip download: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)",
        );
      return;
    }

    if (globalIsChecking) return;
    globalIsChecking = true;

    const isEnabled = safeGet(() => {
      if (typeof Updates?.isEnabled === "undefined") return false;
      return Updates.isEnabled;
    }, false);

    if (!isEnabled) {
      console.log("[Updates] Skip download: expo-updates not enabled");
      globalIsChecking = false;
      return;
    }

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
      const result = await safeGet(
        () => Updates!.fetchUpdateAsync(),
        Promise.resolve({ isNew: false } as Awaited<
          ReturnType<typeof Updates.fetchUpdateAsync>
        >),
      );

      if (result && result.isNew) {
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdatePending: true,
        }));
        const newUpdateId = safeGet(
          () => (result as any)?.manifest?.id || (result as any)?.updateId,
          null,
        );
        console.log(
          "[Updates] Update fetched, isNew: true, updateId:",
          newUpdateId,
        );
        showUpdateBanner(newUpdateId);
      } else {
        console.log(
          "[Updates] Fetch complete, isNew:",
          !!(result && result.isNew),
        );
        setStatus((prev) => ({ ...prev, isDownloading: false }));
      }
    } catch (error) {
      console.error("[Updates] Download failed (non-fatal):", error);
      setStatus((prev) => ({
        ...prev,
        isDownloading: false,
        error:
          error instanceof Error ? error.message : "Failed to download update",
      }));
    } finally {
      globalIsChecking = false;
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev)
        console.log(
          "[Updates] Skip check: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)",
        );
      return;
    }

    if (globalIsChecking) return;
    globalIsChecking = true;

    const isEnabled = safeGet(() => {
      if (typeof Updates?.isEnabled === "undefined") return false;
      return Updates.isEnabled;
    }, false);

    if (!isEnabled) {
      console.log("[Updates] Skip check: expo-updates not enabled");
      globalIsChecking = false;
      return;
    }

    const channel = safeGet(() => Updates?.channel ?? null, null);
    const runtimeVersion = safeGet(() => Updates?.runtimeVersion ?? null, null);
    console.log(
      "[Updates] Checking — channel:",
      channel,
      "runtimeVersion:",
      runtimeVersion,
    );

    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const update = await safeGet(
        () => Updates!.checkForUpdateAsync(),
        Promise.resolve({ isAvailable: false } as Awaited<
          ReturnType<typeof Updates.checkForUpdateAsync>
        >),
      );

      console.log(
        "[Updates] Check result — isAvailable:",
        !!update?.isAvailable,
      );

      if (
        !update?.isAvailable &&
        Updates &&
        typeof Updates.readLogEntriesAsync === "function"
      ) {
        try {
          const entries = await Updates.readLogEntriesAsync(60_000);
          const last = entries.slice(-5);
          if (last.length)
            console.log(
              "[Updates] Native log entries (last 5):",
              JSON.stringify(last, null, 0),
            );
        } catch (e) {
          /* no-op */
        }
      }

      if (update && update.isAvailable) {
        setStatus((prev) => ({
          ...prev,
          isChecking: false,
          isUpdateAvailable: true,
        }));
        downloadAndApplyUpdate();
      } else {
        setStatus((prev) => ({
          ...prev,
          isChecking: false,
          isUpdateAvailable: false,
        }));
      }
    } catch (error) {
      console.warn("[Updates] Check failed (non-fatal):", error);
      setStatus((prev) => ({
        ...prev,
        isChecking: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check for updates",
      }));
    } finally {
      globalIsChecking = false;
    }
  }, [downloadAndApplyUpdate]);

  useEffect(() => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev) {
      console.log(
        "[Updates] Skipping OTA init in __DEV__ (use production build or EXPO_PUBLIC_FORCE_OTA_CHECK=true)",
      );
      return;
    }

    if (!enabled) {
      console.log(
        "[Updates] OTA init deferred — waiting for splash to complete",
      );
      return;
    }

    if (!Updates || !UpdatesAvailable || globalIsInitialized) return;

    try {
      const isEnabled = safeGet(() => {
        if (typeof Updates?.isEnabled === "undefined") return false;
        return Updates.isEnabled;
      }, false);

      if (!isEnabled) {
        console.log("[Updates] OTA init skipped: expo-updates not enabled");
        return;
      }

      globalIsInitialized = true;
      const ch = safeGet(() => Updates?.channel ?? null, null);
      const rv = safeGet(() => Updates?.runtimeVersion ?? null, null);
      console.log(
        "[Updates] OTA init — channel:",
        ch,
        "runtimeVersion:",
        rv,
        "| Publish: eas update --channel",
        ch ?? "production",
      );

      let appStateSubscription: ReturnType<
        typeof AppState.addEventListener
      > | null = null;
      let updateEventSubscription: { remove: () => void } | null = null;

      const initialCheckTimer = setTimeout(() => {
        checkForUpdates().catch((e) =>
          console.error("[Updates] Initial check error:", e),
        );
      }, 1500);

      const retryTimer = setTimeout(() => {
        console.log("[Updates] Second OTA check (retry)");
        checkForUpdates().catch((e) =>
          console.error("[Updates] Retry check error:", e),
        );
      }, 15000);

      const handleAppStateChange = (nextState: AppStateStatus) => {
        if (nextState === "active") {
          console.log("[Updates] App came to foreground");
          try {
            checkForUpdates();
          } catch (error) {
            console.error(
              "[Updates] Foreground check error (non-fatal):",
              error,
            );
          }
        }
      };

      try {
        appStateSubscription = AppState.addEventListener(
          "change",
          handleAppStateChange,
        );
      } catch (error) {
        console.error(
          "[Updates] Failed to add app state listener (non-fatal):",
          error,
        );
      }

      try {
        const addListener =
          (Updates as any)?.addUpdatesStateChangeListener ||
          (Updates as any)?.addListener;
        if (Updates && typeof addListener === "function") {
          updateEventSubscription = addListener((event: any) => {
            try {
              console.log(
                "[Updates] Received update event:",
                event?.type || event?.context?.isUpdateAvailable,
              );

              const eventType = event?.type;
              const isUpdateAvailable = event?.context?.isUpdateAvailable;
              if (
                eventType === "UPDATE_AVAILABLE" ||
                eventType === "updateAvailable" ||
                isUpdateAvailable === true
              ) {
                console.log("[Updates] Update available event received");
                setStatus((prev) => ({
                  ...prev,
                  isUpdateAvailable: true,
                }));
                downloadAndApplyUpdate();
              }
            } catch (eventError) {
              console.error(
                "[Updates] Error handling event (non-fatal):",
                eventError,
              );
            }
          });
        }
      } catch (listenerError) {
        console.error(
          "[Updates] Failed to add update listener (non-fatal):",
          listenerError,
        );
      }

      return () => {
        try {
          clearTimeout(initialCheckTimer);
          if (retryTimer) clearTimeout(retryTimer);
          if (appStateSubscription) appStateSubscription.remove();
          if (updateEventSubscription) updateEventSubscription.remove();
        } catch (cleanupError) {
          console.error("[Updates] Cleanup error (non-fatal):", cleanupError);
        }
      };
    } catch (error) {
      console.error(
        "[Updates] Initialization error (non-fatal, app continues):",
        error,
      );
      globalIsInitialized = false;
    }
  }, [checkForUpdates, downloadAndApplyUpdate, enabled]);

  const currentlyRunning = safeGet(() => {
    if (!Updates || !UpdatesAvailable) return null;
    const isEnabled = safeGet(() => Updates?.isEnabled, false);
    if (!isEnabled) return null;

    return {
      updateId: safeGet(() => Updates?.updateId, null),
      channel: safeGet(() => Updates?.channel, null),
      createdAt: safeGet(() => Updates?.createdAt, null),
      isEmbeddedLaunch: safeGet(() => Updates?.isEmbeddedLaunch, null),
    };
  }, null);

  return {
    ...status,
    checkForUpdates,
    downloadAndApplyUpdate,
    currentlyRunning,
  };
}
