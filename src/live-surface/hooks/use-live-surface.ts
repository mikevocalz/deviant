/**
 * useLiveSurface Hook
 * Main integration hook — fetches payload, updates native surfaces.
 * Mounted once in the protected layout. No polling — updates on app open + push.
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveSurface } from "../api";
import { useLiveSurfaceStore } from "../store";
import type { LiveSurfacePayload } from "../types";

const QUERY_KEY = ["liveSurface"] as const;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Try to start/update iOS Live Activity via the native module.
 * Safe-wrapped: no-op if module not available (OTA without native build).
 */
function updateNativeSurface(payload: LiveSurfacePayload): void {
  try {
    if (Platform.OS === "ios") {
      // Dynamic require — safe if native module not in current build
      const mod = require("@/src/live-surface/native/ios-bridge");
      mod?.updateLiveActivity?.(payload);
    } else if (Platform.OS === "android") {
      const mod = require("@/src/live-surface/native/android-bridge");
      mod?.updateNotification?.(payload);
    }
  } catch {
    // Native module not available in this build — silent no-op
  }
}

/**
 * Try to end the native surface.
 */
function endNativeSurface(): void {
  try {
    if (Platform.OS === "ios") {
      const mod = require("@/src/live-surface/native/ios-bridge");
      mod?.endLiveActivity?.();
    } else if (Platform.OS === "android") {
      const mod = require("@/src/live-surface/native/android-bridge");
      mod?.dismissNotification?.();
    }
  } catch {
    // Silent no-op
  }
}

export function useLiveSurface() {
  const setPayload = useLiveSurfaceStore((s) => s.setPayload);
  const setActive = useLiveSurfaceStore((s) => s.setActive);
  const setError = useLiveSurfaceStore((s) => s.setError);

  const appStateRef = useRef(AppState.currentState);

  const { data, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchLiveSurface,
    staleTime: STALE_TIME,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Sync query result → store + native surface
  useEffect(() => {
    if (data) {
      setPayload(data);
      setActive(true);
      updateNativeSurface(data);
    }
  }, [data, setPayload, setActive]);

  useEffect(() => {
    if (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    }
  }, [error, setError]);

  // Refresh on app resume (no polling)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        refetch();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [refetch]);

  return {
    payload: data ?? null,
    refetch,
    endNativeSurface,
  };
}
