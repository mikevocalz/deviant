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
 * To test OTA in development builds: set EXPO_PUBLIC_FORCE_OTA_CHECK=true.
 * Publish updates with: eas update --channel production
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { toast } from "sonner-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FORCE_OTA_IN_DEV =
  typeof process !== "undefined" &&
  process.env?.EXPO_PUBLIC_FORCE_OTA_CHECK === "true";

// Storage keys for update deduplication
const STORAGE_KEY_LAST_SHOWN_UPDATE = "@dvnt_last_shown_update_id";
const STORAGE_KEY_DISMISSED_UPDATE = "@dvnt_dismissed_update_id";

// SINGLETON: Module-level state to prevent multiple hook instances from racing
let globalHasShownToastThisSession = false;
let globalIsInitialized = false;
let globalIsChecking = false;
let globalToastVisible = false; // Track if toast is currently visible
let globalLastToastTime = 0; // Debounce toast showing
const TOAST_DEBOUNCE_MS = 5000; // 5 second debounce between toast shows
const TOAST_ID = "ota-update-toast"; // Single consistent toast ID

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
  // Default to enabled if not specified (backwards compatible)
  const { enabled = true } = options;

  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  // DIAGNOSTIC: Log on hook mount to verify it's being called
  useEffect(() => {
    console.log(
      "[Updates] Hook mounted - __DEV__:",
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
        "[Updates] expo-updates module loaded, isEnabled:",
        safeGet(() => Updates?.isEnabled, false),
      );
    }
  }, [enabled]);

  // Safe reload - never throws
  // CRITICAL: Wait for Zustand persist rehydration to complete before reloading
  const reloadApp = useCallback(async () => {
    try {
      console.log("[Updates] Preparing to restart app...");

      // Wait for auth store rehydration to complete
      try {
        const { waitForRehydration, flushAuthStorage } =
          await import("@/lib/stores/auth-store");
        await waitForRehydration();
        console.log("[Updates] Rehydration complete, flushing storage...");
        await flushAuthStorage();
        console.log("[Updates] Storage flushed");
      } catch (rehydrateError) {
        console.warn(
          "[Updates] Rehydration wait failed (non-fatal):",
          rehydrateError,
        );
        // Continue anyway - better to reload than hang
      }

      // Small additional delay to ensure all writes are persisted
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log("[Updates] Restarting app...");
      if (Updates && typeof Updates.reloadAsync === "function") {
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error("[Updates] Error reloading (non-fatal):", error);
      // Don't throw - just log
    }
  }, []);

  // PHASE 6 FIX: Show update toast with robust single-instance guarantee
  // - Only ONE toast visible at a time
  // - Debounced to prevent rapid fire
  // - Persists show/dismiss state across sessions
  // - Always dismissible
  const showUpdateToast = useCallback(
    async (updateId?: string) => {
      try {
        const now = Date.now();

        // CHECK 1: Debounce - prevent rapid toast showing
        if (now - globalLastToastTime < TOAST_DEBOUNCE_MS) {
          console.log("[Updates] Toast debounced, skipping");
          return;
        }

        // CHECK 2: Already shown this session
        if (globalHasShownToastThisSession) {
          console.log("[Updates] Toast already shown this session, skipping");
          return;
        }

        // CHECK 3: Toast currently visible
        if (globalToastVisible) {
          console.log("[Updates] Toast already visible, skipping");
          return;
        }

        // Get the update ID - either passed in or from expo-updates
        const currentUpdateId =
          updateId || safeGet(() => Updates?.updateId, null);
        console.log("[Updates] Checking update ID:", currentUpdateId);

        if (currentUpdateId) {
          // Check if this update was already shown or dismissed
          const [lastShownId, dismissedId] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEY_LAST_SHOWN_UPDATE).catch(
              () => null,
            ),
            AsyncStorage.getItem(STORAGE_KEY_DISMISSED_UPDATE).catch(
              () => null,
            ),
          ]);

          console.log(
            "[Updates] Last shown:",
            lastShownId,
            "Dismissed:",
            dismissedId,
          );

          // Skip if already shown for this update ID
          if (lastShownId === currentUpdateId) {
            console.log("[Updates] Already shown for this update ID, skipping");
            return;
          }

          // Skip if user dismissed this specific update
          if (dismissedId === currentUpdateId) {
            console.log("[Updates] User dismissed this update ID, skipping");
            return;
          }

          // Persist that we're showing this update ID
          await AsyncStorage.setItem(
            STORAGE_KEY_LAST_SHOWN_UPDATE,
            currentUpdateId,
          ).catch(() => {});
        }

        // LOCK: Mark all flags BEFORE showing toast
        globalHasShownToastThisSession = true;
        globalToastVisible = true;
        globalLastToastTime = now;

        console.log("[Updates] Showing update toast for ID:", currentUpdateId);

        // CRITICAL: Dismiss ALL existing toasts first to clear any queue
        toast.dismiss();

        // Helper to dismiss toast and reset state
        const dismissToast = () => {
          toast.dismiss(TOAST_ID);
          globalToastVisible = false;
        };

        // Small delay to ensure dismiss completes, then show single toast
        setTimeout(() => {
          toast.success("Update Ready", {
            id: TOAST_ID, // CRITICAL: Consistent ID prevents stacking
            description: "A new update is available. Restart to apply it.",
            duration: Infinity, // NEVER auto-dismiss - user must choose
            action: {
              label: "Restart Now",
              onClick: () => {
                dismissToast();
                reloadApp();
              },
            },
            cancel: {
              label: "Later",
              onClick: async () => {
                console.log("[Updates] User chose to update later");
                dismissToast();
                // Persist dismissal for this specific update ID
                if (currentUpdateId) {
                  await AsyncStorage.setItem(
                    STORAGE_KEY_DISMISSED_UPDATE,
                    currentUpdateId,
                  ).catch(() => {});
                }
              },
            },
          });
        }, 150);
      } catch (error) {
        console.error("[Updates] Error showing toast (non-fatal):", error);
        // Reset flags on error so we can retry
        globalToastVisible = false;
      }
    },
    [reloadApp],
  );

  // Download and apply update - never throws
  const downloadAndApplyUpdate = useCallback(async () => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev)
        console.log(
          "[Updates] Skip download: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)",
        );
      return;
    }

    // Prevent concurrent downloads
    if (globalIsChecking) {
      return;
    }

    globalIsChecking = true;

    // Safely check if updates are enabled
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
        // Extract update ID from the manifest if available
        const newUpdateId = safeGet(
          () => (result as any)?.manifest?.id || (result as any)?.updateId,
          null,
        );
        console.log(
          "[Updates] Update fetched, isNew: true, updateId:",
          newUpdateId,
          "— showing toast",
        );
        showUpdateToast(newUpdateId);
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
  }, [showUpdateToast]);

  // Check for updates - never throws
  const checkForUpdates = useCallback(async () => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev)
        console.log(
          "[Updates] Skip check: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)",
        );
      return;
    }

    if (globalIsChecking) {
      return;
    }

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
      console.error("[Updates] Check failed (non-fatal):", error);
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

  // Initialize update checks - wrapped in error boundary pattern
  // CRITICAL: Only initialize when enabled (after splash completes in production)
  useEffect(() => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev) {
      console.log(
        "[Updates] Skipping OTA init in __DEV__ (use production build or EXPO_PUBLIC_FORCE_OTA_CHECK=true)",
      );
      return;
    }

    // Wait for enabled flag (splash completion) before checking
    if (!enabled) {
      console.log(
        "[Updates] OTA init deferred - waiting for splash to complete",
      );
      return;
    }

    if (!Updates || !UpdatesAvailable || globalIsInitialized) {
      return;
    }

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

      // First check - short delay so OTA toast can show
      const initialCheckTimer = setTimeout(() => {
        checkForUpdates().catch((e) =>
          console.error("[Updates] Initial check error:", e),
        );
      }, 1500);

      // Second check - retry in case first failed (e.g. network) or app opened before update published
      const retryTimer = setTimeout(() => {
        console.log("[Updates] Second OTA check (retry)");
        checkForUpdates().catch((e) =>
          console.error("[Updates] Retry check error:", e),
        );
      }, 15000);

      // Check when app comes to foreground
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

      // Listen for update events - optional, don't fail if unavailable
      try {
        // Use addUpdatesStateChangeListener if available (newer expo-updates API)
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

      // Cleanup
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
      // CRITICAL: Never let initialization errors crash the app
      console.error(
        "[Updates] Initialization error (non-fatal, app continues):",
        error,
      );
      globalIsInitialized = false; // Allow retry on next mount
    }
  }, [checkForUpdates, downloadAndApplyUpdate, enabled]);

  // Safe getter for currently running update info
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
