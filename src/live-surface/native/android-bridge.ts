/**
 * Android Live Surface Bridge
 * Communicates with the Android notification builder via NativeModules.
 *
 * Safe-wrapped: all calls are no-ops if the native module is unavailable.
 */

import { Platform, NativeModules } from "react-native";
import type { LiveSurfacePayload } from "../types";

const MODULE_NAME = "DVNTLiveNotification";

function getNativeModule(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    return NativeModules[MODULE_NAME] ?? null;
  } catch {
    return null;
  }
}

/**
 * Show or update the ongoing notification with the given payload.
 */
export function updateNotification(payload: LiveSurfacePayload): void {
  const mod = getNativeModule();
  if (!mod) {
    console.log("[LiveSurface:Android] Native module not available, skipping");
    return;
  }

  try {
    const jsonPayload = JSON.stringify(payload);
    mod.updateNotification(jsonPayload);
    console.log("[LiveSurface:Android] Updated notification");
  } catch (err) {
    console.error("[LiveSurface:Android] updateNotification error:", err);
  }
}

/**
 * Dismiss the ongoing notification.
 */
export function dismissNotification(): void {
  const mod = getNativeModule();
  if (!mod) return;

  try {
    mod.dismissNotification();
    console.log("[LiveSurface:Android] Dismissed notification");
  } catch (err) {
    console.error("[LiveSurface:Android] dismissNotification error:", err);
  }
}
