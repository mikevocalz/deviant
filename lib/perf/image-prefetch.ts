/**
 * Image Prefetch — Warm expo-image cache for off-screen posts
 *
 * Uses requestIdleCallback (or setTimeout fallback) to prefetch images
 * during idle frames, ensuring no jank on the main thread.
 *
 * Called after the feed's first page renders to warm the next batch.
 */

import { Image } from "expo-image";

const MAX_PREFETCH_BATCH = 10;
const PREFETCH_DELAY_MS = 500;

/**
 * Prefetch a batch of image URLs at low priority.
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
        console.log(`[ImagePrefetch] Queued ${batch.length} images`);
      }
    } catch (err) {
      // Silent fail — prefetch is best-effort
      if (__DEV__) {
        console.warn("[ImagePrefetch] Error:", err);
      }
    }
  });
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
export function prefetchAvatars(
  avatarUrls: (string | null | undefined)[],
) {
  const valid = avatarUrls.filter((u): u is string => !!u && u.length > 0);
  if (valid.length > 0) {
    prefetchImages(valid);
  }
}
