/**
 * MapTiler Configuration
 *
 * Builds style URLs and validates API keys at runtime.
 * Never hardcodes keys — reads from EXPO_PUBLIC_MAPTILER_KEY env var.
 */

const MAPTILER_KEY =
  process.env.EXPO_PUBLIC_MAPTILER_KEY || "";

const MAPTILER_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL ||
  "https://api.maptiler.com/maps/streets-v2-dark/style.json";

/**
 * Whether MapTiler is configured (key is present).
 * Use this to gate map rendering — never crash if key is missing.
 */
export function isMaptilerConfigured(): boolean {
  return MAPTILER_KEY.length > 0;
}

/**
 * Get the full MapTiler style URL with API key appended.
 * Returns null if key is not configured.
 */
export function getMaptilerStyleUrl(): string | null {
  if (!MAPTILER_KEY) {
    if (__DEV__) {
      console.error(
        "[MapTiler] EXPO_PUBLIC_MAPTILER_KEY is not set. " +
          "Add it to your .env file. Maps will not render.",
      );
    }
    return null;
  }

  // If the user provided a full style URL, append key to it
  const separator = MAPTILER_STYLE_URL.includes("?") ? "&" : "?";
  return `${MAPTILER_STYLE_URL}${separator}key=${MAPTILER_KEY}`;
}

/**
 * Get just the API key (for libraries that need it separately).
 */
export function getMaptilerKey(): string {
  return MAPTILER_KEY;
}

/**
 * Whether the maps feature should be enabled.
 * Checks both the feature flag AND key availability.
 */
export function isMapsEnabled(): boolean {
  const flagValue = process.env.EXPO_PUBLIC_FF_MAPS_ENABLED;
  const flagOn =
    flagValue === "true" || flagValue === "1" || (!flagValue && __DEV__);
  return flagOn && isMaptilerConfigured();
}
