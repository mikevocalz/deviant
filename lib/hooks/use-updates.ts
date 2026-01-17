/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates
 */

import { useCallback, useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert, AppState, type AppStateStatus } from "react-native";

export interface UpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  error: string | null;
}

export function useUpdates() {
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  const checkForUpdates = useCallback(async (showAlert = false) => {
    // Skip in development or if updates aren't enabled
    if (__DEV__ || !Updates.isEnabled) {
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

        if (showAlert) {
          Alert.alert(
            "Update Available",
            "A new version is available. Would you like to update now?",
            [
              { text: "Later", style: "cancel" },
              { text: "Update", onPress: downloadAndApplyUpdate },
            ],
          );
        } else {
          // Auto-download in background
          downloadAndApplyUpdate();
        }
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
  }, []);

  const downloadAndApplyUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdatePending: true,
        }));

        Alert.alert(
          "Update Ready",
          "The app will now restart to apply the update.",
          [
            {
              text: "Restart Now",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ],
          { cancelable: false },
        );
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
  }, []);

  // Check for updates on app launch and when app comes to foreground
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

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
    currentlyRunning: Updates.isEnabled
      ? {
          updateId: Updates.updateId,
          channel: Updates.channel,
          createdAt: Updates.createdAt,
          isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        }
      : null,
  };
}
