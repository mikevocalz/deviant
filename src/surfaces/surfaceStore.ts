/**
 * Surface payload storage.
 * On RN this returns null — the native module persists to UserDefaults(suiteName: APP_GROUP_ID)
 * when updateLiveActivity succeeds. The widget reads from native.
 */

import type { LiveSurfacePayload } from "@/src/live-surface/types";

export const SURFACE_STORE_KEY = "surfacePayload";

export const APP_GROUP_ID = "group.com.dvnt.app";

export interface SurfaceStoredPayload extends LiveSurfacePayload {
  tile1HeroLocalPath?: string;
  tile2LocalPaths?: string[];
}

/**
 * Returns the stored surface payload.
 * On RN this always returns null. The native Swift module persists to
 * UserDefaults(suiteName: APP_GROUP_ID) when it updates the Live Activity.
 * The widget reads directly from native storage.
 */
export async function getSurfacePayload(): Promise<SurfaceStoredPayload | null> {
  return null;
}
