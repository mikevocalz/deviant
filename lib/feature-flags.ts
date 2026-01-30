/**
 * FEATURE FLAGS
 * 
 * Runtime feature toggles that can be disabled without redeploy.
 * Flags are fetched from backend and cached locally.
 * 
 * USAGE:
 * if (isFeatureEnabled("video_autoplay")) { ... }
 * 
 * ROLLBACK:
 * Set flag to false in Payload CMS admin → Feature Flags collection
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "dvnt_feature_flags";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface FeatureFlags {
  video_autoplay: boolean;
  story_replies_dm: boolean;
  event_rsvp: boolean;
  event_comments: boolean;
  push_notifications: boolean;
  threaded_comments: boolean;
  comment_likes: boolean;
}

// Default flags (safe fallbacks)
const DEFAULT_FLAGS: FeatureFlags = {
  video_autoplay: true,
  story_replies_dm: true,
  event_rsvp: true,
  event_comments: true,
  push_notifications: true,
  threaded_comments: true,
  comment_likes: true,
};

let cachedFlags: FeatureFlags | null = null;
let cacheTimestamp = 0;

/**
 * Check if a feature is enabled.
 * Returns cached value or default if not loaded.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  if (cachedFlags) {
    return cachedFlags[flag] ?? DEFAULT_FLAGS[flag];
  }
  return DEFAULT_FLAGS[flag];
}

/**
 * Get all feature flags.
 */
export function getAllFlags(): FeatureFlags {
  return cachedFlags || DEFAULT_FLAGS;
}

/**
 * Load feature flags from backend.
 * Call this on app startup.
 */
export async function loadFeatureFlags(apiUrl: string): Promise<void> {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedFlags && now - cacheTimestamp < CACHE_TTL) {
      return;
    }

    // Try to load from AsyncStorage first (offline support)
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        cachedFlags = { ...DEFAULT_FLAGS, ...parsed.flags };
        cacheTimestamp = parsed.timestamp || 0;

        // If cache is still fresh, use it
        if (now - cacheTimestamp < CACHE_TTL) {
          return;
        }
      } catch {
        // Invalid cache, continue to fetch
      }
    }

    // Fetch from backend
    const response = await fetch(`${apiUrl}/api/feature-flags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Transform array to object
      const flags: Partial<FeatureFlags> = {};
      if (data.docs && Array.isArray(data.docs)) {
        for (const doc of data.docs) {
          if (doc.key && typeof doc.enabled === "boolean") {
            flags[doc.key as keyof FeatureFlags] = doc.enabled;
          }
        }
      }

      cachedFlags = { ...DEFAULT_FLAGS, ...flags };
      cacheTimestamp = now;

      // Persist to AsyncStorage
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ flags: cachedFlags, timestamp: cacheTimestamp })
      );

      console.log("[FeatureFlags] Loaded:", cachedFlags);
    } else {
      console.warn("[FeatureFlags] Failed to fetch, using defaults");
      cachedFlags = DEFAULT_FLAGS;
    }
  } catch (error) {
    console.warn("[FeatureFlags] Error loading flags:", error);
    cachedFlags = DEFAULT_FLAGS;
  }
}

/**
 * Force refresh feature flags.
 */
export async function refreshFeatureFlags(apiUrl: string): Promise<void> {
  cacheTimestamp = 0; // Invalidate cache
  await loadFeatureFlags(apiUrl);
}

/**
 * Override a flag locally (for testing).
 * Only works in DEV mode.
 */
export function overrideFlag(
  flag: keyof FeatureFlags,
  value: boolean
): void {
  if (__DEV__) {
    if (!cachedFlags) {
      cachedFlags = { ...DEFAULT_FLAGS };
    }
    cachedFlags[flag] = value;
    console.log(`[FeatureFlags] DEV override: ${flag} = ${value}`);
  }
}
