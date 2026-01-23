/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useUIStore } from "@/lib/stores/ui-store";

// Dynamically import expo-updates to handle Expo Go where native module isn't available
let Updates: typeof import("expo-updates") | null = null;
try {
  Updates = require("expo-updates");
} catch {
  // expo-updates not available (e.g., in Expo Go)
}

export interface UpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  error: string | null;
}

export function useUpdates() {
  const showToast = useUIStore((s) => s.showToast);
  const hasShownUpdateToast = useRef(false);
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  const downloadAndApplyUpdate = useCallback(async () => {
    if (__DEV__ || !Updates || !Updates.isEnabled) return;

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdatePending: true,
        }));

        // Only show toast once per session
        if (!hasShownUpdateToast.current) {
          hasShownUpdateToast.current = true;
          showToast("info", "Update Ready", "Tap to restart and apply update");
          // Auto-restart after a short delay
          setTimeout(async () => {
            if (Updates) await Updates.reloadAsync();
          }, 2000);
        }
      } else {
        setStatus((prev) => ({ ...prev, isDownloading: false }));
      }
    } catch (error) {
      console.error("[Updates] Download failed:", error);
      setStatus((prev) => ({
        ...prev,
        isDownloading: false,
        error:
          error instanceof Error ? error.message : "Failed to download update",
      }));
    }
  }, [showToast]);

  const checkForUpdates = useCallback(async (showAlert = false) => {
    // Skip in development or if updates aren't available/enabled
    if (__DEV__ || !Updates || !Updates.isEnabled) {
      return;
    }

    setStatus((prev) => ({ ...prev, isChecking: true, error: null }));

    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setStatus((prev) => ({
          ...prev,
          isChecking: false,
          isUpdateAvailable: true,
        }));

        // Auto-download in background (no toast for checking)
        downloadAndApplyUpdate();
      } else {
        setStatus((prev) => ({
          ...prev,
          isChecking: false,
          isUpdateAvailable: false,
        }));
      }
    } catch (error) {
      console.error("[Updates] Check failed:", error);
      setStatus((prev) => ({
        ...prev,
        isChecking: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check for updates",
      }));
    }
  }, [downloadAndApplyUpdate]);

  // Check for updates on app launch and when app comes to foreground
  useEffect(() => {
    if (__DEV__ || !Updates || !Updates.isEnabled) return;

    // Initial check
    checkForUpdates();

    // Check when app comes to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkForUpdates();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [checkForUpdates]);

  return {
    ...status,
    checkForUpdates,
    downloadAndApplyUpdate,
    currentlyRunning: Updates?.isEnabled
      ? {
          updateId: Updates.updateId,
          channel: Updates.channel,
          createdAt: Updates.createdAt,
          isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        }
      : null,
  };
}
