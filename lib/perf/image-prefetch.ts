/**
 * Image Prefetch — Warm image caches for off-screen content
 *
 * Uses requestIdleCallback (or setTimeout fallback) to prefetch images
 * during idle frames, ensuring no jank on the main thread.
 *
 * TWO cache systems in this app:
 * - expo-image (used by our components via `Image` from "expo-image")
 * - React Native Image (used by 3rd-party libs like react-native-insta-story)
 *
 * `prefetchImages()` warms expo-image cache.
 * `prefetchImagesRN()` warms React Native's Image cache.
 * For content rendered by 3rd-party libs, call BOTH or just prefetchImagesRN.
 */

import { Image } from "expo-image";
import { Image as RNImage } from "react-native";

const MAX_PREFETCH_BATCH = 30;
const PREFETCH_DELAY_MS = 500;

/**
 * Prefetch a batch of image URLs into expo-image cache.
 * Safe to call with duplicates — expo-image deduplicates internally.
 */
export function prefetchImages(urls: string[]) {
  if (!urls.length) return;

  const batch = urls.slice(0, MAX_PREFETCH_BATCH).filter(Boolean);
  if (!batch.length) return;

  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, PREFETCH_DELAY_MS);

  schedule(() => {
    try {
      Image.prefetch(batch);
      if (__DEV__) {
        console.log(
          `[ImagePrefetch] expo-image: queued ${batch.length} images`,
        );
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("[ImagePrefetch] expo-image error:", err);
      }
    }
  });
}

/**
 * Prefetch image URLs into React Native's built-in Image cache.
 * Required for 3rd-party components that use RN's Image (e.g. react-native-insta-story).
 * expo-image and RN Image have SEPARATE caches — prefetching one does NOT warm the other.
 */
export function prefetchImagesRN(urls: string[]) {
  if (!urls.length) return;

  const batch = urls.slice(0, MAX_PREFETCH_BATCH).filter(Boolean);
  if (!batch.length) return;

  // RN Image.prefetch is per-URL, fire them all immediately (no idle scheduling)
  // They run on native threads and don't block JS.
  for (const url of batch) {
    RNImage.prefetch(url).catch(() => {
      // Silent fail — prefetch is best-effort
    });
  }

  if (__DEV__) {
    console.log(`[ImagePrefetch] RN Image: prefetching ${batch.length} images`);
  }
}

/**
 * Extract prefetchable image URLs from feed posts.
 * Focuses on the first media item per post (the hero image).
 */
export function extractFeedImageUrls(
  posts: { media?: { url: string; type: string }[] }[],
): string[] {
  const urls: string[] = [];

  for (const post of posts) {
    if (!post.media?.length) continue;
    // Only prefetch the first image per post (hero image)
    const firstMedia = post.media[0];
    if (firstMedia?.url && firstMedia.type !== "video") {
      urls.push(firstMedia.url);
    }
  }

  return urls;
}

/**
 * Prefetch avatar URLs from a list of users.
 */
export function prefetchAvatars(avatarUrls: (string | null | undefined)[]) {
  const valid = avatarUrls.filter((u): u is string => !!u && u.length > 0);
  if (valid.length > 0) {
    prefetchImages(valid);
  }
}
