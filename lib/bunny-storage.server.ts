/**
 * Server-side Bunny.net Storage utilities
 *
 * These functions can only be used in API routes (server-side)
 */

// CRITICAL: Production fallbacks for all Bunny config - NEVER empty string for required values
const BUNNY_STORAGE_ZONE =
  process.env.BUNNY_STORAGE_ZONE ||
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE ||
  "dvnt";
const BUNNY_STORAGE_API_KEY =
  process.env.BUNNY_STORAGE_API_KEY ||
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY
  
const BUNNY_STORAGE_REGION =
  process.env.BUNNY_STORAGE_REGION ||
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_REGION ||
  "de";
const BUNNY_CDN_URL =
  process.env.BUNNY_CDN_URL ||
  process.env.EXPO_PUBLIC_BUNNY_CDN_URL ||
  "https://dvnt.b-cdn.net";

// Storage endpoint based on region
const getStorageEndpoint = () => {
  if (BUNNY_STORAGE_REGION === "de" || BUNNY_STORAGE_REGION === "falkenstein") {
    return "storage.bunnycdn.com";
  }
  return `${BUNNY_STORAGE_REGION}.storage.bunnycdn.com`;
};

/**
 * Extract storage path from Bunny CDN URL
 *
 * Examples:
 * - https://dvnt.b-cdn.net/stories/2026/01/23/file.jpg -> stories/2026/01/23/file.jpg
 * - https://storage.bunnycdn.com/dvnt/stories/2026/01/23/file.jpg -> stories/2026/01/23/file.jpg
 */
export function extractStoragePathFromUrl(cdnUrl: string): string | null {
  if (!cdnUrl || typeof cdnUrl !== "string") {
    return null;
  }

  try {
    // Remove protocol and domain
    let path = cdnUrl;

    // Remove CDN URL prefix if present
    if (BUNNY_CDN_URL && cdnUrl.startsWith(BUNNY_CDN_URL)) {
      path = cdnUrl.replace(BUNNY_CDN_URL, "");
    } else {
      // Try to extract path from various Bunny URL formats
      // Format: https://{zone}.b-cdn.net/{path}
      const bCdnMatch = cdnUrl.match(/\.b-cdn\.net\/(.+)$/);
      if (bCdnMatch) {
        path = bCdnMatch[1];
      } else {
        // Format: https://storage.bunnycdn.com/{zone}/{path}
        const storageMatch = cdnUrl.match(
          /storage\.bunnycdn\.com\/[^\/]+\/(.+)$/,
        );
        if (storageMatch) {
          path = storageMatch[1];
        } else {
          // Try to extract anything after the domain
          const urlMatch = cdnUrl.match(/https?:\/\/[^\/]+\/(.+)$/);
          if (urlMatch) {
            path = urlMatch[1];
          }
        }
      }
    }

    // Remove leading slash
    path = path.replace(/^\//, "");

    // Remove storage zone from path if it's included
    if (BUNNY_STORAGE_ZONE && path.startsWith(`${BUNNY_STORAGE_ZONE}/`)) {
      path = path.replace(`${BUNNY_STORAGE_ZONE}/`, "");
    }

    return path || null;
  } catch (error) {
    console.error("[Bunny] Error extracting path from URL:", cdnUrl, error);
    return null;
  }
}

/**
 * Delete a file from Bunny.net Edge Storage by CDN URL
 */
export async function deleteFromBunnyByUrl(cdnUrl: string): Promise<boolean> {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    console.warn("[Bunny] Storage not configured");
    return false;
  }

  const path = extractStoragePathFromUrl(cdnUrl);
  if (!path) {
    console.warn("[Bunny] Could not extract path from URL:", cdnUrl);
    return false;
  }

  try {
    const endpoint = getStorageEndpoint();
    const deleteUrl = `https://${endpoint}/${BUNNY_STORAGE_ZONE}/${path}`;

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY,
      },
    });

    if (response.ok) {
      console.log("[Bunny] ✓ Deleted file:", path);
      return true;
    } else {
      console.warn("[Bunny] Delete failed:", response.status, path);
      return false;
    }
  } catch (error) {
    console.error("[Bunny] Delete error:", error);
    return false;
  }
}

/**
 * Delete multiple files from Bunny.net by their CDN URLs
 */
export async function deleteMultipleFromBunny(cdnUrls: string[]): Promise<{
  deleted: number;
  failed: number;
  errors: string[];
}> {
  const results = await Promise.allSettled(
    cdnUrls.map((url) => deleteFromBunnyByUrl(url)),
  );

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      deleted++;
    } else {
      failed++;
      if (result.status === "rejected") {
        errors.push(`Failed to delete ${cdnUrls[index]}: ${result.reason}`);
      } else {
        errors.push(`Failed to delete ${cdnUrls[index]}`);
      }
    }
  });

  return { deleted, failed, errors };
}
