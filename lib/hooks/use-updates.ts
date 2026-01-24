/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { toast } from "sonner-native";

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
  const hasShownUpdateToast = useRef(false);
  const toastIdRef = useRef<string | number | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  const showUpdateToast = useCallback(() => {
    try {
      // Only show toast once per session
      if (!hasShownUpdateToast.current) {
        hasShownUpdateToast.current = true;
        
        // Show toast with restart button
        toastIdRef.current = toast.info("Update Ready", {
          description: "A new update is available. Restart to apply it.",
          duration: Infinity, // Don't auto-dismiss
          action: {
            label: "Restart App",
            onPress: async () => {
              try {
                if (Updates) {
                  await Updates.reloadAsync();
                }
              } catch (error) {
                console.error("[Updates] Error reloading:", error);
              }
            },
          },
        });
      }
    } catch (error) {
      console.error("[Updates] Error showing toast:", error);
    }
  }, []);

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

        // Show toast with restart button
        showUpdateToast();
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
  }, [showUpdateToast]);

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
    // Early return if in dev or updates not available
    if (__DEV__ || !Updates) return;
    
    // Check if updates are enabled
    if (!Updates.isEnabled) return;

    try {
      // Check if there's already a pending update on app start
      // Only check if isEmbeddedLaunch property exists
      if (typeof Updates.isEmbeddedLaunch !== "undefined" && Updates.isEmbeddedLaunch === false) {
        // There's a pending update that was downloaded but not applied
        setStatus((prev) => ({
          ...prev,
          isUpdatePending: true,
        }));
        showUpdateToast();
      }

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
    } catch (error) {
      console.error("[Updates] Error in useEffect:", error);
      // Don't crash the app if updates fail
    }
  }, [checkForUpdates, showUpdateToast]);

  return {
    ...status,
    checkForUpdates,
    downloadAndApplyUpdate,
    currentlyRunning: Updates?.isEnabled
      ? {
          updateId: Updates.updateId || null,
          channel: Updates.channel || null,
          createdAt: Updates.createdAt || null,
          isEmbeddedLaunch: typeof Updates.isEmbeddedLaunch !== "undefined" ? Updates.isEmbeddedLaunch : null,
        }
      : null,
  };
}
