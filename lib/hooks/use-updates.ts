/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates.
 * CRITICAL: This hook must NEVER crash the app. All operations are wrapped
 * in try-catch blocks and failures are logged.
 *
 * To test OTA in development builds: set EXPO_PUBLIC_FORCE_OTA_CHECK=true.
 * Publish updates with: eas update --channel production
 * (Use the same channel as your EAS build profile, e.g. production/preview/development.)
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus, Alert, Platform } from "react-native";
import { toast } from "sonner-native";

const FORCE_OTA_IN_DEV =
  typeof process !== "undefined" &&
  process.env?.EXPO_PUBLIC_FORCE_OTA_CHECK === "true";

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
  // CRITICAL: Wait for Zustand persist rehydration to complete before reloading
  const reloadApp = useCallback(async () => {
    try {
      console.log("[Updates] Preparing to restart app...");
      
      // Wait for auth store rehydration to complete
      try {
        const { waitForRehydration, flushAuthStorage } = await import("@/lib/stores/auth-store");
        await waitForRehydration();
        console.log("[Updates] Rehydration complete, flushing storage...");
        await flushAuthStorage();
        console.log("[Updates] Storage flushed");
      } catch (rehydrateError) {
        console.warn("[Updates] Rehydration wait failed (non-fatal):", rehydrateError);
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

  // CRITICAL: Show update toast - MUST ALWAYS SHOW when update is available
  // This toast MUST NEVER be removed or disabled
  // It has two buttons: "Update Later" (left, dismisses) and "Restart App Now" (right, restarts)
  const showUpdateToast = useCallback(() => {
    // Reset flag to allow showing again if needed (e.g., after dismissing)
    // This ensures the toast can be shown again if user dismisses and update is still pending
    hasShownUpdateToast.current = true;
    toastAttempts.current += 1;
    
    console.log("[Updates] Showing update toast, attempt:", toastAttempts.current);
    
    // Strategy 1: Try sonner-native toast with TWO actions
    const tryToast = () => {
      try {
        // CRITICAL: duration: Infinity ensures toast never auto-dismisses
        // User must explicitly choose "Update Later" or "Restart App Now"
        toast.success("Update Ready", {
          description: "A new update is available. Restart to apply it.",
          duration: Infinity, // NEVER auto-dismiss - user must choose
          action: {
            label: "Restart App Now",
            onClick: reloadApp,
          },
          cancel: {
            label: "Update Later",
            onClick: () => {
              console.log("[Updates] User chose to update later");
              // Reset flag so toast can be shown again if update is still pending
              hasShownUpdateToast.current = false;
            },
          },
        });
        console.log("[Updates] Toast shown successfully with both buttons");
        return true;
      } catch (toastError) {
        console.log("[Updates] Toast failed:", toastError);
        return false;
      }
    };

    // Strategy 2: Fallback to native Alert with two buttons
    const tryAlert = () => {
      try {
        Alert.alert(
          "Update Available",
          "A new update has been downloaded. Restart the app to apply it.",
          [
            { 
              text: "Update Later", 
              style: "cancel",
              onPress: () => {
                console.log("[Updates] User chose to update later");
                // Reset flag so alert can be shown again if update is still pending
                hasShownUpdateToast.current = false;
              },
            },
            { 
              text: "Restart App Now", 
              onPress: reloadApp,
            },
          ]
        );
        console.log("[Updates] Alert shown successfully with both buttons");
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
          console.warn("[Updates] Both toast and alert failed - retrying...");
          // Retry after delay
          setTimeout(() => {
            hasShownUpdateToast.current = false;
            showUpdateToast();
          }, 2000);
        }
      }, 1000);
    }
  }, [reloadApp]);

  // Download and apply update - never throws
  const downloadAndApplyUpdate = useCallback(async () => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev) console.log("[Updates] Skip download: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)");
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
      console.log("[Updates] Skip download: expo-updates not enabled");
      isCheckingRef.current = false;
      return;
    }

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
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
        console.log("[Updates] Update fetched, isNew: true — showing toast");
        showUpdateToast();
      } else {
        console.log("[Updates] Fetch complete, isNew:", !!(result && result.isNew));
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
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev || !Updates || !UpdatesAvailable) {
      if (skipDev) console.log("[Updates] Skip check: __DEV__ (set EXPO_PUBLIC_FORCE_OTA_CHECK=true to test)");
      return;
    }

    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    const isEnabled = safeGet(() => {
      if (typeof Updates?.isEnabled === "undefined") return false;
      return Updates.isEnabled;
    }, false);

    if (!isEnabled) {
      console.log("[Updates] Skip check: expo-updates not enabled");
      isCheckingRef.current = false;
      return;
    }

    const channel = safeGet(() => Updates?.channel ?? null, null);
    const runtimeVersion = safeGet(() => Updates?.runtimeVersion ?? null, null);
    console.log("[Updates] Checking — channel:", channel, "runtimeVersion:", runtimeVersion);

    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const update = await safeGet(
        () => Updates!.checkForUpdateAsync(),
        Promise.resolve({ isAvailable: false } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>)
      );

      console.log("[Updates] Check result — isAvailable:", !!update?.isAvailable);

      if (!update?.isAvailable && Updates && typeof Updates.readLogEntriesAsync === "function") {
        try {
          const entries = await Updates.readLogEntriesAsync(60_000);
          const last = entries.slice(-5);
          if (last.length) console.log("[Updates] Native log entries (last 5):", JSON.stringify(last, null, 0));
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
        error: error instanceof Error ? error.message : "Failed to check for updates",
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, [downloadAndApplyUpdate]);

  // Initialize update checks - wrapped in error boundary pattern
  useEffect(() => {
    const skipDev = __DEV__ && !FORCE_OTA_IN_DEV;
    if (skipDev) {
      console.log("[Updates] Skipping OTA init in __DEV__ (use production build or EXPO_PUBLIC_FORCE_OTA_CHECK=true)");
      return;
    }
    if (!Updates || !UpdatesAvailable || isInitialized.current) {
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

      isInitialized.current = true;
      const ch = safeGet(() => Updates?.channel ?? null, null);
      const rv = safeGet(() => Updates?.runtimeVersion ?? null, null);
      console.log("[Updates] OTA init — channel:", ch, "runtimeVersion:", rv, "| Publish: eas update --channel", ch ?? "production");

      let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
      let updateEventSubscription: { remove: () => void } | null = null;

      // First check - short delay so OTA toast can show
      const initialCheckTimer = setTimeout(() => {
        checkForUpdates().catch((e) => console.error("[Updates] Initial check error:", e));
      }, 1500);

      // Second check - retry in case first failed (e.g. network) or app opened before update published
      const retryTimer = setTimeout(() => {
        console.log("[Updates] Second OTA check (retry)");
        checkForUpdates().catch((e) => console.error("[Updates] Retry check error:", e));
      }, 15000);

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
          if (retryTimer) clearTimeout(retryTimer);
          if (appStateSubscription) appStateSubscription.remove();
          if (updateEventSubscription) updateEventSubscription.remove();
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
