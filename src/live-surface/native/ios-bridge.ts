/**
 * iOS Live Activity Bridge
 * Communicates with the native DVNTLiveActivity widget extension via
 * App Groups shared UserDefaults + ActivityKit APIs.
 *
 * Safe-wrapped: all calls are no-ops if the native module is unavailable.
 */

import { Platform, NativeModules } from "react-native";
import type { LiveSurfacePayload } from "../types";

const MODULE_NAME = "DVNTLiveActivity";

function getNativeModule(): any | null {
  if (Platform.OS !== "ios") return null;
  try {
    return NativeModules[MODULE_NAME] ?? null;
  } catch {
    return null;
  }
}

/**
 * Start or update the iOS Live Activity with the given payload.
 * If a Live Activity is already running, updates it.
 * If none exists, starts a new one.
 */
export function updateLiveActivity(payload: LiveSurfacePayload): void {
  const mod = getNativeModule();
  if (!mod) {
    if (__DEV__) {
      console.warn("[LiveSurface:iOS] DVNTLiveActivity native module not available — rebuild with native code to enable Live Activity");
    }
    return;
  }

  try {
    const jsonPayload = JSON.stringify(payload);
    mod.updateLiveActivity(jsonPayload);
    if (__DEV__) {
      console.log("[LiveSurface:iOS] updateLiveActivity called successfully");
    }
  } catch (err) {
    console.error("[LiveSurface:iOS] updateLiveActivity error:", err);
  }
}

/**
 * End the current Live Activity.
 */
export function endLiveActivity(): void {
  const mod = getNativeModule();
  if (!mod) return;

  try {
    mod.endLiveActivity();
    console.log("[LiveSurface:iOS] Ended live activity");
  } catch (err) {
    console.error("[LiveSurface:iOS] endLiveActivity error:", err);
  }
}

/**
 * Check if Live Activities are supported and enabled.
 */
export async function areLiveActivitiesEnabled(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;

  try {
    return await mod.areLiveActivitiesEnabled();
  } catch {
    return false;
  }
}
