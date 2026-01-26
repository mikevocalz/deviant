/**
 * Bunny.net Edge Storage API Client
 *
 * Handles media uploads to Bunny.net CDN
 * Docs: https://docs.bunny.net/reference/storage-api
 */

import * as FileSystem from "expo-file-system";

// Storage zone configuration from environment
const BUNNY_STORAGE_ZONE = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE || "";
const BUNNY_STORAGE_API_KEY =
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY || "";
const BUNNY_STORAGE_REGION =
  process.env.EXPO_PUBLIC_BUNNY_STORAGE_REGION || "ny"; // ny, la, sg, etc.
const BUNNY_CDN_URL = process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "";

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
 * Upload a file to Bunny.net Edge Storage
 * Uses expo-file-system for reliable native uploads
 *
 * @param uri - Local file URI (file://)
 * @param folder - Destination folder (e.g., "posts", "events", "stories")
 * @param onProgress - Progress callback
 */
export async function uploadToBunny(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<UploadResult> {
  const BUNDLE_VERSION = "v5-native-upload";
  console.log("[Bunny] =========================================");
  console.log("[Bunny] Starting upload (", BUNDLE_VERSION, ")");
  console.log("[Bunny] URI:", uri.substring(0, 100));
  console.log("[Bunny] Config:", {
    zone: BUNNY_STORAGE_ZONE || "MISSING",
    key: BUNNY_STORAGE_API_KEY ? `${BUNNY_STORAGE_API_KEY.substring(0, 8)}...` : "MISSING",
    region: BUNNY_STORAGE_REGION || "MISSING",
    cdnUrl: BUNNY_CDN_URL || "MISSING",
  });

  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    console.error("[Bunny] FATAL: Storage not configured");
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: `Storage not configured (zone: ${BUNNY_STORAGE_ZONE ? "ok" : "missing"}, key: ${BUNNY_STORAGE_API_KEY ? "ok" : "missing"})`,
    };
  }

  try {
    // Generate unique filename with social-network style path
    const extension = getExtension(uri);
    const filename = generateFilename(`file.${extension}`);
    const path = buildStoragePath(folder, filename, userId);

    // Bunny Storage API endpoint
    const endpoint = getStorageEndpoint();
    const uploadUrl = `https://${endpoint}/${BUNNY_STORAGE_ZONE}/${path}`;
    console.log("[Bunny] Upload URL:", uploadUrl);

    // Normalize the URI for expo-file-system
    let normalizedUri = uri;
    if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
      normalizedUri = `file://${uri}`;
    }
    console.log("[Bunny] Normalized URI:", normalizedUri.substring(0, 100));

    // Check if file exists and get info
    console.log("[Bunny] Checking file info...");
    let fileInfo: FileSystem.FileInfo;
    try {
      fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      console.log("[Bunny] File info:", JSON.stringify(fileInfo));
    } catch (infoError) {
      console.error("[Bunny] Failed to get file info:", infoError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Cannot access file: ${infoError instanceof Error ? infoError.message : String(infoError)}`,
      };
    }

    if (!fileInfo.exists) {
      console.error("[Bunny] File does not exist at:", normalizedUri);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: "File does not exist",
      };
    }

    const fileSize = (fileInfo as any).size || 0;
    console.log("[Bunny] File exists, size:", fileSize, "bytes");

    // Use FileSystem.uploadAsync for reliable native upload
    console.log("[Bunny] Starting native upload via FileSystem.uploadAsync...");
    
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, normalizedUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "AccessKey": BUNNY_STORAGE_API_KEY,
        "Content-Type": "application/octet-stream",
      },
    });

    console.log("[Bunny] Upload response status:", uploadResult.status);
    console.log("[Bunny] Upload response body:", uploadResult.body?.substring(0, 200));

    if (uploadResult.status === 201 || uploadResult.status === 200) {
      // Construct CDN URL
      const cdnUrl = BUNNY_CDN_URL
        ? `${BUNNY_CDN_URL}/${path}`
        : `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${path}`;

      console.log("[Bunny] SUCCESS! CDN URL:", cdnUrl);
      
      // Call progress callback with 100%
      onProgress?.({ loaded: fileSize, total: fileSize, percentage: 100 });
      
      return {
        success: true,
        url: cdnUrl,
        path,
        filename,
      };
    } else {
      console.error("[Bunny] Upload failed with status:", uploadResult.status);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Upload failed: HTTP ${uploadResult.status} - ${uploadResult.body || "No response"}`,
      };
    }
  } catch (error) {
    console.error("[Bunny] Upload exception:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Bunny] Error details:", errorMessage);
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: `Upload error: ${errorMessage}`,
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
): Promise<Array<{ type: "image" | "video"; url: string; success: boolean; error?: string }>> {
  const results: Array<{
    type: "image" | "video";
    url: string;
    success: boolean;
    error?: string;
  }> = [];
  const totalFiles = files.length;
  let completedFiles = 0;

  console.log("[Bunny] uploadMultipleToBunny: uploading", totalFiles, "files");

  for (const file of files) {
    console.log("[Bunny] Uploading file", completedFiles + 1, "of", totalFiles, ":", file.uri.substring(0, 80));
    
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

    console.log("[Bunny] File", completedFiles + 1, "result:", result.success ? "SUCCESS" : `FAILED - ${result.error}`);

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
