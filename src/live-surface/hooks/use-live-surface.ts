/**
 * useLiveSurface Hook
 * Main integration hook — fetches payload, updates native surfaces.
 * iOS: uses Voltra for Live Activity + Dynamic Island + Widgets.
 *      Lock screen carousel cycles 3 tiles every 5 s via updateLiveActivity.
 * Android: uses custom native module for ongoing notification.
 * Mounted once in the protected layout.
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveSurface } from "../api";
import { useLiveSurfaceStore } from "../store";
import type { LiveSurfacePayload } from "../types";
import type { CarouselTile } from "../voltra-views";

const QUERY_KEY = ["liveSurface"] as const;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_NAME = "dvnt-event";
const CAROUSEL_INTERVAL_MS = 5_000;

let activeActivityId: string | null = null;
let carouselTimer: ReturnType<typeof setInterval> | null = null;
let carouselIndex = 0;

// ── Voltra lazy imports (cached after first call) ──
async function getVoltra() {
  const client = await import("voltra/client");
  const views = await import("@/src/live-surface/voltra-views");
  return { ...client, ...views };
}

/**
 * Preload hero images for all carousel tiles + upcoming events.
 * Returns the set of asset keys that succeeded — callers skip tiles whose key is absent.
 */
async function preloadAllHeroImages(
  payload: LiveSurfacePayload,
): Promise<Set<string>> {
  const { preloadImages } = await import("voltra/client");

  const images: { url: string; key: string }[] = [];

  // tile1 → event-hero-0
  if (payload.tile1.heroThumbUrl) {
    images.push({ url: payload.tile1.heroThumbUrl, key: "event-hero-0" });
  }

  // tile3 upcoming items → event-hero-1, event-hero-2
  (payload.tile3?.items ?? []).slice(0, 2).forEach((item, i) => {
    if (item.heroThumbUrl) {
      images.push({ url: item.heroThumbUrl, key: `event-hero-${i + 1}` });
    }
  });

  if (images.length === 0) return new Set();

  // 10s timeout — don't let a slow CDN block the Live Activity push
  const timeoutPromise = new Promise<{
    succeeded: string[];
    failed: { key: string; error?: string }[];
  }>((resolve) =>
    setTimeout(
      () =>
        resolve({
          succeeded: [],
          failed: images.map((image) => ({ key: image.key })),
        }),
      10_000,
    ),
  );

  type PreloadResult = {
    succeeded: string[];
    failed: { key: string; error?: string }[];
  };
  const result: PreloadResult = await Promise.race([
    preloadImages(images),
    timeoutPromise,
  ]);
  const succeededKeys = new Set(result.succeeded);

  console.log(
    "[LiveSurface] preloadImages:",
    result.succeeded.length,
    "ok,",
    result.failed.length,
    "failed",
    result.failed.map((r) => r.key),
  );

  return succeededKeys;
}

/**
 * Push one carousel frame to the Live Activity (lock screen + Dynamic Island).
 */
async function pushCarouselFrame(
  tiles: CarouselTile[],
  index: number,
  weather: LiveSurfacePayload["weather"],
): Promise<void> {
  const {
    startLiveActivity,
    updateLiveActivity,
    isLiveActivityActive,
    lockScreenView,
    dynamicIslandVariants,
  } = await getVoltra();

  const tile = tiles[index % tiles.length];

  const variants = {
    lockScreen: lockScreenView(
      tile,
      weather,
      index % tiles.length,
      tiles.length,
    ),
    island: dynamicIslandVariants(tile, weather),
  };

  if (activeActivityId && isLiveActivityActive(ACTIVITY_NAME)) {
    await updateLiveActivity(activeActivityId, variants);
  } else {
    activeActivityId = await startLiveActivity(variants, {
      activityName: ACTIVITY_NAME,
      deepLinkUrl: tile.deepLink,
    });
  }
}

/**
 * Start the carousel interval that cycles tiles on the lock screen.
 */
function startCarousel(
  tiles: CarouselTile[],
  weather: LiveSurfacePayload["weather"],
): void {
  stopCarousel();
  if (tiles.length <= 1) return;

  carouselTimer = setInterval(async () => {
    carouselIndex = (carouselIndex + 1) % tiles.length;
    try {
      await pushCarouselFrame(tiles, carouselIndex, weather);
    } catch (e) {
      if (__DEV__) console.warn("[LiveSurface] carousel tick failed:", e);
    }
  }, CAROUSEL_INTERVAL_MS);
}

function stopCarousel(): void {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

/**
 * Full update: preload images → push first frame → start carousel → update widgets.
 */
async function updateVoltraSurfaces(
  payload: LiveSurfacePayload,
): Promise<void> {
  try {
    const { buildCarouselTiles, smallWidget, mediumWidget, largeWidget } =
      await import("@/src/live-surface/voltra-views");
    const { updateWidget } = await import("voltra/client");

    // 1. Preload all hero images — get back which keys succeeded
    const succeededKeys = await preloadAllHeroImages(payload);

    // 2. Build carousel tiles, filtering out any whose hero failed to preload
    const allTiles = buildCarouselTiles(payload.tile1, payload.tile3?.items);
    const tiles = allTiles.filter(
      (t) => succeededKeys.has(t.heroAssetName) || allTiles.indexOf(t) === 0,
    );
    const weather = payload.weather;

    // 3. Push first frame immediately
    carouselIndex = 0;
    await pushCarouselFrame(tiles, 0, weather);

    // 4. Start carousel cycling (skipped if only 1 tile)
    startCarousel(tiles, weather);

    // 5. Update Home Screen Widgets
    const upcoming = payload.tile3?.items;
    await updateWidget(
      "dvnt_events",
      {
        systemSmall: smallWidget(payload.tile1, weather),
        systemMedium: mediumWidget(payload.tile1, weather),
        systemLarge: largeWidget(payload.tile1, weather, upcoming),
      },
      {
        deepLinkUrl: payload.tile1.deepLink,
      },
    );

    console.log(
      "[LiveSurface] Voltra surfaces updated:",
      payload.tile1.title,
      `(${tiles.length} carousel tiles)`,
    );
  } catch (e) {
    console.error("[LiveSurface] Voltra update failed:", e);
  }
}

/**
 * Android: ongoing notification via custom native module.
 */
function updateAndroidSurface(payload: LiveSurfacePayload): void {
  try {
    const mod = require("@/src/live-surface/native/android-bridge");
    mod?.updateNotification?.(payload);
  } catch (e) {
    if (__DEV__) console.warn("[LiveSurface] Android update failed:", e);
  }
}

/**
 * End native surfaces on both platforms.
 */
async function endNativeSurface(): Promise<void> {
  try {
    stopCarousel();
    if (Platform.OS === "ios") {
      const { endAllLiveActivities } = await import("voltra/client");
      await endAllLiveActivities();
      activeActivityId = null;
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
    retry: 2,
  });

  // Sync query result → store + native surfaces
  useEffect(() => {
    if (data) {
      setPayload(data);
      setActive(true);
      if (Platform.OS === "ios") {
        updateVoltraSurfaces(data);
      } else if (Platform.OS === "android") {
        updateAndroidSurface(data);
      }
    }
    return () => {
      stopCarousel();
    };
  }, [data, setPayload, setActive]);

  useEffect(() => {
    if (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      if (__DEV__) {
        console.warn("[LiveSurface] Fetch error:", error);
      }
    }
  }, [error, setError]);

  // Refresh on app resume, pause carousel in background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        refetch();
      }
      if (nextState !== "active") {
        stopCarousel();
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
      stopCarousel();
    };
  }, [refetch]);

  return {
    payload: data ?? null,
    refetch,
    endNativeSurface,
  };
}
