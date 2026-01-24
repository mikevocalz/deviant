/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates
 * 
 * CRITICAL: This hook must NEVER crash the app. All operations are wrapped
 * in try-catch blocks and failures are silently logged.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus, Alert, Platform } from "react-native";
import { toast } from "sonner-native";

// Dynamically import expo-updates to handle Expo Go where native module isn't available
let Updates: typeof import("expo-updates") | null = null;
let UpdatesAvailable = false;

try {
  if (Platform.OS !== "web") {
    Updates = require("expo-updates");
    UpdatesAvailable = true;
  }
} catch (error) {
  // expo-updates not available (e.g., in Expo Go or web)
  console.log("[Updates] expo-updates not available");
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

export function useUpdates() {
  const hasShownUpdateToast = useRef(false);
  const toastAttempts = useRef(0);
  const isInitialized = useRef(false);
  const isCheckingRef = useRef(false);
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  // Safe reload - never throws
  const reloadApp = useCallback(async () => {
    try {
      console.log("[Updates] Restarting app...");
      if (Updates && typeof Updates.reloadAsync === "function") {
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error("[Updates] Error reloading (non-fatal):", error);
      // Don't throw - just log
    }
  }, []);

  // Show update toast with multiple fallback strategies
  const showUpdateToast = useCallback(() => {
    // Prevent duplicate toasts
    if (hasShownUpdateToast.current) {
      return;
    }
    
    hasShownUpdateToast.current = true;
    toastAttempts.current += 1;
    
    console.log("[Updates] Showing update toast, attempt:", toastAttempts.current);
    
    // Strategy 1: Try sonner-native toast
    const tryToast = () => {
      try {
        toast.success("Update Ready", {
          description: "A new update is available. Tap to restart.",
          duration: Infinity,
          action: {
            label: "Restart App",
            onPress: reloadApp,
          },
        });
        console.log("[Updates] Toast shown successfully");
        return true;
      } catch (toastError) {
        console.log("[Updates] Toast failed:", toastError);
        return false;
      }
    };

    // Strategy 2: Fallback to native Alert after delay
    const tryAlert = () => {
      try {
        Alert.alert(
          "Update Available",
          "A new update has been downloaded. Restart the app to apply it.",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart Now", onPress: reloadApp },
          ]
        );
        console.log("[Updates] Alert shown successfully");
        return true;
      } catch (alertError) {
        console.error("[Updates] Alert failed:", alertError);
        return false;
      }
    };

    // Try toast first
    if (!tryToast()) {
      // If toast fails, try alert after a short delay
      setTimeout(() => {
        if (!tryAlert()) {
          console.warn("[Updates] Both toast and alert failed - user will see update on next launch");
        }
      }, 1000);
    }
  }, [reloadApp]);

  // Download and apply update - never throws
  const downloadAndApplyUpdate = useCallback(async () => {
    // Early returns - don't throw
    if (__DEV__ || !Updates || !UpdatesAvailable) {
      return;
    }

    // Prevent concurrent downloads
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    // Safely check if updates are enabled
    const isEnabled = safeGet(() => {
      if (typeof Updates?.isEnabled === "undefined") return false;
      return Updates.isEnabled;
    }, false);

    if (!isEnabled) {
      isCheckingRef.current = false;
      return;
    }

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
      // Fetch update
      const result = await safeGet(
        () => Updates!.fetchUpdateAsync(),
        Promise.resolve({ isNew: false } as Awaited<ReturnType<typeof Updates.fetchUpdateAsync>>)
      );

      if (result && result.isNew) {
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdatePending: true,
        }));

        // Show toast - CRITICAL: This must always show
        showUpdateToast();
      } else {
        setStatus((prev) => ({ ...prev, isDownloading: false }));
      }
    } catch (error) {
      console.error("[Updates] Download failed (non-fatal):", error);
      setStatus((prev) => ({
        ...prev,
        isDownloading: false,
        error: error instanceof Error ? error.message : "Failed to download update",
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, [showUpdateToast]);

  // Check for updates - never throws
  const checkForUpdates = useCallback(async () => {
    // Early returns - don't throw
    if (__DEV__ || !Updates || !UpdatesAvailable) {
      return;
    }

    // Prevent concurrent checks
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    // Safely check if updates are enabled
    const isEnabled = safeGet(() => {
      if (typeof Updates?.isEnabled === "undefined") return false;
      return Updates.isEnabled;
    }, false);

    if (!isEnabled) {
      isCheckingRef.current = false;
      return;
    }

    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const update = await safeGet(
        () => Updates!.checkForUpdateAsync(),
        Promise.resolve({ isAvailable: false } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>)
      );

      if (update && update.isAvailable) {
        setStatus((prev) => ({
          ...prev,
          isChecking: false,
          isUpdateAvailable: true,
        }));

        // Auto-download in background
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
        error: error instanceof Error ? error.message : "Failed to check for updates",
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, [downloadAndApplyUpdate]);

  // Initialize update checks - wrapped in error boundary pattern
  useEffect(() => {
    // Early return if not available
    if (__DEV__ || !Updates || !UpdatesAvailable || isInitialized.current) {
      return;
    }

    // Wrap entire initialization in try-catch
    try {
      // Safely check if updates are enabled
      const isEnabled = safeGet(() => {
        if (typeof Updates?.isEnabled === "undefined") return false;
        return Updates.isEnabled;
      }, false);

      if (!isEnabled) {
        console.log("[Updates] Updates not enabled, skipping");
        return;
      }

      isInitialized.current = true;
      console.log("[Updates] Initializing update checks");

      let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
      let updateEventSubscription: { remove: () => void } | null = null;

      // Initial check - delay significantly to let app fully initialize
      const initialCheckTimer = setTimeout(() => {
        try {
          checkForUpdates();
        } catch (error) {
          console.error("[Updates] Initial check error (non-fatal):", error);
        }
      }, 8000); // Increased delay to ensure app is fully loaded

      // Check when app comes to foreground
      const handleAppStateChange = (nextState: AppStateStatus) => {
        if (nextState === "active") {
          console.log("[Updates] App came to foreground");
          try {
            checkForUpdates();
          } catch (error) {
            console.error("[Updates] Foreground check error (non-fatal):", error);
          }
        }
      };

      try {
        appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
      } catch (error) {
        console.error("[Updates] Failed to add app state listener (non-fatal):", error);
      }

      // Listen for update events - optional, don't fail if unavailable
      try {
        if (Updates && typeof Updates.addListener === "function") {
          updateEventSubscription = Updates.addListener((event: any) => {
            try {
              console.log("[Updates] Received update event:", event?.type);

              const eventType = event?.type;
              if (
                eventType === "UPDATE_AVAILABLE" ||
                eventType === "updateAvailable" ||
                eventType === Updates?.UpdateEventType?.UPDATE_AVAILABLE
              ) {
                console.log("[Updates] Update available event received");
                setStatus((prev) => ({
                  ...prev,
                  isUpdateAvailable: true,
                }));
                downloadAndApplyUpdate();
              }
            } catch (eventError) {
              console.error("[Updates] Error handling event (non-fatal):", eventError);
            }
          });
        }
      } catch (listenerError) {
        console.error("[Updates] Failed to add update listener (non-fatal):", listenerError);
      }

      // Cleanup
      return () => {
        try {
          clearTimeout(initialCheckTimer);
          if (appStateSubscription) {
            appStateSubscription.remove();
          }
          if (updateEventSubscription) {
            updateEventSubscription.remove();
          }
        } catch (cleanupError) {
          console.error("[Updates] Cleanup error (non-fatal):", cleanupError);
        }
      };
    } catch (error) {
      // CRITICAL: Never let initialization errors crash the app
      console.error("[Updates] Initialization error (non-fatal, app continues):", error);
      isInitialized.current = false; // Allow retry on next mount
    }
  }, [checkForUpdates, downloadAndApplyUpdate]);

  // Safe getter for currently running update info
  const currentlyRunning = safeGet(
    () => {
      if (!Updates || !UpdatesAvailable) return null;
      const isEnabled = safeGet(() => Updates?.isEnabled, false);
      if (!isEnabled) return null;

      return {
        updateId: safeGet(() => Updates?.updateId, null),
        channel: safeGet(() => Updates?.channel, null),
        createdAt: safeGet(() => Updates?.createdAt, null),
        isEmbeddedLaunch: safeGet(() => Updates?.isEmbeddedLaunch, null),
      };
    },
    null
  );

  return {
    ...status,
    checkForUpdates,
    downloadAndApplyUpdate,
    currentlyRunning,
  };
}
