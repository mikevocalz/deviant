/**
 * Image caching for Live Surface widgets.
 *
 * RULES:
 * - Widgets/Live Activity MUST NOT fetch remote images at render time.
 * - The native DVNTLiveActivity module downloads images to the App Group when
 *   updateLiveActivity receives the payload. Local paths are stored and
 *   passed to the widget for display.
 * - If local path is missing: widget shows a designed placeholder (never empty).
 *
 * This module provides the contract — actual caching happens in native.
 */

export interface SurfaceImageInput {
  url: string;
  key: string;
}

/**
 * Returns stable hashed filename for a remote URL.
 * Used for deterministic local paths in the shared container.
 */
export function hashUrlForFilename(url: string): string {
  let h = 0;
  const str = url;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `t_${Math.abs(h).toString(16)}`;
}

/**
 * Build list of URLs to cache from a Live Surface payload.
 * Native module uses these when downloading to App Group.
 */
export function getUrlsToCacheFromPayload(payload: {
  tile1?: { heroThumbUrl?: string | null };
  tile2?: { items?: Array<{ thumbUrl?: string | null }> };
}): SurfaceImageInput[] {
  const inputs: SurfaceImageInput[] = [];
  const hero = payload.tile1?.heroThumbUrl;
  if (hero && typeof hero === "string" && hero.startsWith("http")) {
    inputs.push({ url: hero, key: "hero" });
  }
  const items = payload.tile2?.items ?? [];
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    const thumb = items[i]?.thumbUrl;
    if (thumb && typeof thumb === "string" && thumb.startsWith("http")) {
      inputs.push({ url: thumb, key: `t2_${i}` });
    }
  }
  return inputs;
}

/**
 * Caches images for use in the Live Activity surface.
 * The native Swift module downloads images to the App Group when it receives the payload.
 * RN passes the payload; native handles download → local paths → persistence.
 */
export async function cacheImages(
  inputs: SurfaceImageInput[]
): Promise<Map<string, string>> {
  if (inputs.length > 0 && __DEV__) {
    console.log(
      "[Surfaces] cacheImages:",
      inputs.length,
      "URLs — native module will download to App Group"
    );
  }
  return new Map();
}
