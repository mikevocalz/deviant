/**
 * Bunny.net Edge Storage API Client
 *
 * Handles media uploads to Bunny.net CDN using expo-file-system for reliable native uploads
 * Docs: https://docs.bunny.net/reference/storage-api
 */

import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

// Storage zone configuration from environment
// CRITICAL: Production values as fallback - empty strings NEVER work on mobile
const BUNNY_STORAGE_ZONE = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE || "dvnt";
const BUNNY_STORAGE_API_KEY =
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY ||
  "a51bbae5-586e-4bc4-a9c6086f6825-4507-484b";
const BUNNY_STORAGE_REGION =
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_REGION || "de";
const BUNNY_CDN_URL =
  process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";

// Log config at module load for debugging
console.log(
  "[Bunny] Config loaded - zone:",
  BUNNY_STORAGE_ZONE,
  "region:",
  BUNNY_STORAGE_REGION,
  "cdn:",
  BUNNY_CDN_URL ? "set" : "MISSING",
);

// Storage endpoint based on region
const getStorageEndpoint = () => {
  if (BUNNY_STORAGE_REGION === "de" || BUNNY_STORAGE_REGION === "falkenstein") {
    return "storage.bunnycdn.com";
  }
  return `${BUNNY_STORAGE_REGION}.storage.bunnycdn.com`;
};

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

/**
 * Generate a unique filename with timestamp and random string
 */
function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}-${random}.${extension}`;
}

/**
 * Generate a date-based path prefix (YYYY/MM/DD)
 */
function getDatePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Build a social-network style storage path
 * Format: {folder}/{userId}/{YYYY}/{MM}/{DD}/{timestamp}-{random}.{ext}
 * Example: posts/user_abc123/2026/01/16/1737069600000-x7k9.jpg
 */
function buildStoragePath(
  folder: string,
  filename: string,
  userId?: string,
): string {
  const datePath = getDatePath();

  if (userId) {
    return `${folder}/${userId}/${datePath}/${filename}`;
  }

  return `${folder}/${datePath}/${filename}`;
}

/**
 * Get file extension from URI or mime type
 */
function getExtension(uri: string, mimeType?: string): string {
  // Try to get from URI
  const uriMatch = uri.match(/\.(\w+)(?:\?|$)/);
  if (uriMatch) return uriMatch[1];

  // Try to get from mime type
  if (mimeType) {
    const mimeMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/heic": "heic",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/mov": "mov",
    };
    return mimeMap[mimeType] || "jpg";
  }

  return "jpg";
}

/**
 * Ensure file is accessible - copy ph:// or content:// URIs to cache
 */
async function ensureFileAccessible(uri: string): Promise<string> {
  console.log("[Bunny] Checking file accessibility:", uri.substring(0, 80));

  // If it's already a file:// URI, verify it exists
  if (uri.startsWith("file://")) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        console.log("[Bunny] File exists at:", uri.substring(0, 80));
        return uri;
      }
    } catch (e) {
      console.warn("[Bunny] Error checking file:", e);
    }
  }

  // For ph:// (iOS Photos) or content:// (Android) URIs, copy to cache
  if (
    uri.startsWith("ph://") ||
    uri.startsWith("content://") ||
    uri.startsWith("assets-library://")
  ) {
    console.log("[Bunny] Copying asset to cache...");
    const extension = getExtension(uri);
    const cacheUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;

    try {
      await FileSystem.copyAsync({
        from: uri,
        to: cacheUri,
      });
      console.log("[Bunny] Copied to cache:", cacheUri);
      return cacheUri;
    } catch (copyError) {
      console.error("[Bunny] Copy to cache failed:", copyError);
      // Return original URI as fallback
      return uri;
    }
  }

  return uri;
}

/**
 * Upload a file to Bunny.net Edge Storage
 * Uses FileSystem.uploadAsync for reliable native uploads
 *
 * @param uri - Local file URI (file://, ph://, content://)
 * @param folder - Destination folder (e.g., "posts", "events", "stories")
 * @param onProgress - Progress callback
 */
export async function uploadToBunny(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<UploadResult> {
  const BUNDLE_VERSION = "v8-filesystem-upload";
  console.log("[Bunny] =========================================");
  console.log("[Bunny] Starting upload (", BUNDLE_VERSION, ")");
  console.log("[Bunny] Platform:", Platform.OS);
  console.log("[Bunny] URI:", uri.substring(0, 100));
  console.log("[Bunny] Folder:", folder);
  console.log("[Bunny] UserId:", userId || "none");

  // Check configuration
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    console.error(
      "[Bunny] Missing config - zone:",
      !!BUNNY_STORAGE_ZONE,
      "key:",
      !!BUNNY_STORAGE_API_KEY,
    );
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: "Storage not configured",
    };
  }

  console.log(
    "[Bunny] Config OK - zone:",
    BUNNY_STORAGE_ZONE,
    "region:",
    BUNNY_STORAGE_REGION,
  );

  try {
    // Generate unique filename with social-network style path
    const extension = getExtension(uri);
    const filename = generateFilename(`file.${extension}`);
    const path = buildStoragePath(folder, filename, userId);

    // Bunny Storage API endpoint
    const endpoint = getStorageEndpoint();
    const uploadUrl = `https://${endpoint}/${BUNNY_STORAGE_ZONE}/${path}`;

    console.log("[Bunny] Upload URL:", uploadUrl);
    console.log("[Bunny] Filename:", filename);
    console.log("[Bunny] Path:", path);

    // Ensure file is accessible (copy ph:// or content:// to cache if needed)
    let accessibleUri: string;
    try {
      accessibleUri = await ensureFileAccessible(uri);
      console.log("[Bunny] Accessible URI:", accessibleUri.substring(0, 100));
    } catch (accessError) {
      console.error("[Bunny] File access error:", accessError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `File access error: ${accessError instanceof Error ? accessError.message : String(accessError)}`,
      };
    }

    // Get file info
    let fileInfo: FileSystem.FileInfo;
    try {
      fileInfo = await FileSystem.getInfoAsync(accessibleUri);
      console.log("[Bunny] File info:", JSON.stringify(fileInfo));

      if (!fileInfo.exists) {
        console.error("[Bunny] File does not exist:", accessibleUri);
        return {
          success: false,
          url: "",
          path: "",
          filename: "",
          error: "File does not exist",
        };
      }
    } catch (infoError) {
      console.error("[Bunny] Error getting file info:", infoError);
      // Continue anyway - some URIs may not report info correctly but still work
    }

    // Report initial progress
    onProgress?.({ loaded: 0, total: 100, percentage: 0 });

    // Method 1: FileSystem.uploadAsync (native, most reliable for React Native)
    console.log("[Bunny] Method 1: Using FileSystem.uploadAsync...");
    let uploadSuccess = false;
    let uploadError = "";

    try {
      const uploadResult = await FileSystem.uploadAsync(
        uploadUrl,
        accessibleUri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            AccessKey: BUNNY_STORAGE_API_KEY,
            "Content-Type": "application/octet-stream",
          },
        },
      );

      console.log("[Bunny] Upload response status:", uploadResult.status);
      console.log(
        "[Bunny] Upload response body:",
        uploadResult.body?.substring(0, 200),
      );

      if (uploadResult.status === 201 || uploadResult.status === 200) {
        uploadSuccess = true;
        onProgress?.({ loaded: 100, total: 100, percentage: 100 });
      } else {
        uploadError = `Upload failed with status ${uploadResult.status}: ${uploadResult.body}`;
        console.error("[Bunny] Upload failed:", uploadError);
      }
    } catch (nativeError) {
      console.error("[Bunny] Method 1 failed:", nativeError);
      uploadError =
        nativeError instanceof Error
          ? nativeError.message
          : String(nativeError);

      // Method 2: Fallback to base64 + fetch (works on some platforms)
      console.log("[Bunny] Method 2: Falling back to base64+fetch...");
      try {
        const base64 = await FileSystem.readAsStringAsync(accessibleUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log("[Bunny] Base64 length:", base64.length);

        // Convert base64 to binary
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const fetchResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            AccessKey: BUNNY_STORAGE_API_KEY,
            "Content-Type": "application/octet-stream",
          },
          body: bytes,
        });

        console.log("[Bunny] Fetch response status:", fetchResponse.status);

        if (fetchResponse.status === 201 || fetchResponse.status === 200) {
          uploadSuccess = true;
          onProgress?.({ loaded: 100, total: 100, percentage: 100 });
        } else {
          const responseText = await fetchResponse.text();
          uploadError = `Fetch upload failed: ${fetchResponse.status} - ${responseText}`;
          console.error("[Bunny] Fetch upload failed:", uploadError);
        }
      } catch (fetchError) {
        console.error("[Bunny] Method 2 also failed:", fetchError);
        uploadError = `Both upload methods failed. Native: ${uploadError}, Fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
      }
    }

    if (uploadSuccess) {
      // Construct CDN URL
      const cdnUrl = BUNNY_CDN_URL
        ? `${BUNNY_CDN_URL}/${path}`
        : `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${path}`;

      console.log("[Bunny] ✓ Upload SUCCESS! CDN URL:", cdnUrl);
      return {
        success: true,
        url: cdnUrl,
        path,
        filename,
      };
    } else {
      console.error("[Bunny] ✗ Upload FAILED:", uploadError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: uploadError || "Upload failed",
      };
    }
  } catch (error) {
    console.error("[Bunny] Unexpected error:", error);
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload multiple files to Bunny.net
 *
 * @param files - Array of file URIs with types
 * @param folder - Destination folder
 * @param onProgress - Progress callback (receives overall progress)
 */
export async function uploadMultipleToBunny(
  files: Array<{ uri: string; type: "image" | "video" }>,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<
  Array<{
    type: "image" | "video";
    url: string;
    success: boolean;
    error?: string;
  }>
> {
  const results: Array<{
    type: "image" | "video";
    url: string;
    success: boolean;
    error?: string;
  }> = [];
  const totalFiles = files.length;
  let completedFiles = 0;

  for (const file of files) {
    const result = await uploadToBunny(
      file.uri,
      folder,
      (fileProgress) => {
        if (onProgress) {
          // Calculate overall progress
          const fileContribution = fileProgress.percentage / totalFiles;
          const completedContribution = (completedFiles / totalFiles) * 100;
          onProgress({
            loaded: completedFiles + fileProgress.percentage / 100,
            total: totalFiles,
            percentage: Math.round(completedContribution + fileContribution),
          });
        }
      },
      userId,
    );

    results.push({
      type: file.type,
      url: result.url,
      success: result.success,
      error: result.error,
    });

    completedFiles++;
  }

  return results;
}

/**
 * Delete a file from Bunny.net Edge Storage
 */
export async function deleteFromBunny(path: string): Promise<boolean> {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
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

    return response.ok;
  } catch (error) {
    console.error("[Bunny] Delete error:", error);
    return false;
  }
}
