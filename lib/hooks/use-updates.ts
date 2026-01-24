/**
 * OTA Updates Hook
 *
 * Handles checking for and applying expo-updates
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { AppState, type AppStateStatus, Alert } from "react-native";
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
  const toastAttempts = useRef(0);
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
  });

  const reloadApp = useCallback(async () => {
    try {
      console.log("[Updates] Restarting app...");
      if (Updates) {
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error("[Updates] Error reloading:", error);
    }
  }, []);

  const showUpdateToast = useCallback(() => {
    // CRITICAL: This toast MUST always show when an update is available
    // DO NOT remove or disable this functionality - it's essential for OTA updates
    
    hasShownUpdateToast.current = true;
    toastAttempts.current += 1;
    
    console.log("[Updates] Attempting to show update toast, attempt:", toastAttempts.current);
    
    // Use multiple fallback strategies to ensure toast always shows
    const showToastWithRetry = (delay: number, attempt: number) => {
      setTimeout(() => {
        try {
          console.log("[Updates] Showing toast attempt", attempt, "after", delay, "ms delay");
          
          // CRITICAL: Always show this toast - never skip it
          toast.success("Update Ready", {
            description: "A new update is available. Tap to restart.",
            duration: Infinity, // Never auto-dismiss
            action: {
              label: "Restart App",
              onPress: reloadApp,
            },
          });
          
          console.log("[Updates] Toast.success called successfully");
        } catch (toastError) {
          console.error("[Updates] Toast attempt", attempt, "failed:", toastError);
          
          // If toast fails after retries, show a native Alert as fallback
          // This ensures the user is ALWAYS notified of available updates
          if (attempt >= 5) {
            console.log("[Updates] Using Alert fallback after", attempt, "attempts");
            try {
              Alert.alert(
                "Update Available",
                "A new update has been downloaded. Restart the app to apply it.",
                [
                  { text: "Later", style: "cancel" },
                  { text: "Restart Now", onPress: reloadApp },
                ]
              );
            } catch (alertError) {
              console.error("[Updates] Alert fallback also failed:", alertError);
              // Last resort: log to console (user will see on next app launch)
              console.warn("[Updates] CRITICAL: Update available but could not notify user");
            }
          } else {
            // Retry with longer delay
            showToastWithRetry(delay * 1.5, attempt + 1);
          }
        }
      }, delay);
    };

    // Start with 500ms delay, will retry with increasing delays if needed
    showToastWithRetry(500, 1);
  }, [reloadApp]);

  const downloadAndApplyUpdate = useCallback(async () => {
    if (__DEV__ || !Updates) return;
    
    // Safely check if updates are enabled
    let isEnabled = false;
    try {
      if (typeof Updates.isEnabled !== "undefined") {
        isEnabled = Updates.isEnabled;
      }
    } catch (enabledError) {
      console.log("[Updates] Could not check isEnabled in downloadAndApplyUpdate:", enabledError);
      return;
    }
    
    if (!isEnabled) return;

    setStatus((prev) => ({ ...prev, isDownloading: true }));

    try {
      // Wrap fetchUpdateAsync in try-catch
      let result;
      try {
        result = await Updates.fetchUpdateAsync();
      } catch (fetchError) {
        console.error("[Updates] fetchUpdateAsync failed:", fetchError);
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          error: fetchError instanceof Error ? fetchError.message : "Failed to download update",
        }));
        return;
      }

      if (result.isNew) {
        setStatus((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdatePending: true,
        }));

        // Show toast with restart button - CRITICAL: This must always show
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
    // Skip in development
    if (__DEV__ || !Updates) {
      return;
    }
    
    // Safely check if updates are enabled
    let isEnabled = false;
    try {
      isEnabled = Updates.isEnabled;
    } catch (enabledError) {
      console.log("[Updates] Could not check isEnabled in checkForUpdates:", enabledError);
      return;
    }
    
    if (!isEnabled) {
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
    if (__DEV__ || !Updates) {
      console.log("[Updates] Skipping - dev mode or Updates not available");
      return;
    }
    
    // Check if updates are enabled - wrap in try-catch as this can throw
    let isEnabled = false;
    try {
      // Safely access isEnabled property
      if (typeof Updates.isEnabled !== "undefined") {
        isEnabled = Updates.isEnabled;
      }
    } catch (enabledError) {
      console.log("[Updates] Could not check isEnabled:", enabledError);
      return;
    }
    
    if (!isEnabled) {
      console.log("[Updates] Skipping - updates not enabled");
      return;
    }

    console.log("[Updates] Initializing update checks");

    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
    let updateEventSubscription: { remove: () => void } | null = null;

    // Wrap entire setup in async IIFE with try-catch
    const setupUpdates = async () => {
      try {
        // Log current update status for debugging - wrap each property access
        let updateId = "none";
        let isEmbeddedLaunch: boolean | undefined;
        let channel: string | undefined;
        
        try {
          if (Updates.updateId) {
            updateId = typeof Updates.updateId === "string" ? Updates.updateId.slice(0, 8) : "none";
          }
          if (typeof Updates.isEmbeddedLaunch !== "undefined") {
            isEmbeddedLaunch = Updates.isEmbeddedLaunch;
          }
          if (Updates.channel) {
            channel = Updates.channel;
          }
        } catch (stateError) {
          console.log("[Updates] Could not read state:", stateError);
        }
        
        console.log("[Updates] Current state:", { updateId, isEmbeddedLaunch, channel });

        // Initial check for new updates - delay significantly to let app fully initialize
        // Wait longer to avoid conflicts with splash screen
        setTimeout(() => {
          try {
            checkForUpdates();
          } catch (checkError) {
            console.log("[Updates] Initial check error:", checkError);
          }
        }, 5000); // Increased from 2000 to 5000

        // Check when app comes to foreground
        const handleAppStateChange = (nextState: AppStateStatus) => {
          if (nextState === "active") {
            console.log("[Updates] App came to foreground, checking for updates");
            try {
              checkForUpdates();
            } catch (checkError) {
              console.log("[Updates] Foreground check error:", checkError);
            }
          }
        };

        appStateSubscription = AppState.addEventListener(
          "change",
          handleAppStateChange,
        );

        // Listen for update events from expo-updates
        if (Updates && typeof Updates.addListener === "function") {
          try {
            // Safely access UpdateEventType
            let UpdateEventType: any;
            try {
              UpdateEventType = Updates.UpdateEventType;
            } catch (typeError) {
              console.log("[Updates] Could not access UpdateEventType:", typeError);
            }
            
            updateEventSubscription = Updates.addListener((event: any) => {
              try {
                console.log("[Updates] Received update event:", event?.type);
                
                if (!UpdateEventType) {
                  // Fallback: check event type as string
                  if (event?.type === "UPDATE_AVAILABLE" || event?.type === "updateAvailable") {
                    console.log("[Updates] Update available event received");
                    setStatus((prev) => ({
                      ...prev,
                      isUpdateAvailable: true,
                    }));
                    downloadAndApplyUpdate();
                  } else if (event?.type === "NO_UPDATE_AVAILABLE" || event?.type === "noUpdateAvailable") {
                    console.log("[Updates] No update available");
                  } else if (event?.type === "ERROR" || event?.type === "error") {
                    console.error("[Updates] Update error event:", event?.message);
                  }
                } else {
                  // Use UpdateEventType enum if available
                  if (event.type === UpdateEventType.UPDATE_AVAILABLE) {
                    console.log("[Updates] Update available event received");
                    setStatus((prev) => ({
                      ...prev,
                      isUpdateAvailable: true,
                    }));
                    downloadAndApplyUpdate();
                  } else if (event.type === UpdateEventType.NO_UPDATE_AVAILABLE) {
                    console.log("[Updates] No update available");
                  } else if (event.type === UpdateEventType.ERROR) {
                    console.error("[Updates] Update error event:", event?.message);
                  }
                }
              } catch (eventHandleError) {
                console.log("[Updates] Error handling event:", eventHandleError);
              }
            });
          } catch (listenerError) {
            console.log("[Updates] Could not add update listener:", listenerError);
          }
        }
      } catch (error) {
        console.error("[Updates] Error in setup:", error);
      }
    };

    setupUpdates();

    return () => {
      try {
        if (appStateSubscription) {
          appStateSubscription.remove();
        }
        if (updateEventSubscription) {
          updateEventSubscription.remove();
        }
      } catch (cleanupError) {
        console.log("[Updates] Cleanup error:", cleanupError);
      }
    };
  }, [checkForUpdates, showUpdateToast, downloadAndApplyUpdate]);

  return {
    ...status,
    checkForUpdates,
    downloadAndApplyUpdate,
    currentlyRunning: (() => {
      try {
        if (!Updates || typeof Updates.isEnabled === "undefined" || !Updates.isEnabled) {
          return null;
        }
        return {
          updateId: Updates.updateId || null,
          channel: Updates.channel || null,
          createdAt: Updates.createdAt || null,
          isEmbeddedLaunch: typeof Updates.isEmbeddedLaunch !== "undefined" ? Updates.isEmbeddedLaunch : null,
        };
      } catch (error) {
        console.log("[Updates] Error getting currentlyRunning:", error);
        return null;
      }
    })(),
  };
}
