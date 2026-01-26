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
 * Copy file to app cache if needed (handles ph:// and other special URIs)
 */
async function ensureFileAccessible(uri: string): Promise<string> {
  // If already a file:// URI in app sandbox, return as-is
  if (uri.startsWith("file://") && !uri.includes("/PhotoData/")) {
    return uri;
  }

  // For content:// URIs (Android) or ph:// URIs (iOS Photo Library),
  // we need to copy to app's cache directory first
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("Cache directory not available");
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = getExtension(uri);
  const tempFileName = `upload_${timestamp}_${random}.${extension}`;
  const tempUri = `${cacheDir}${tempFileName}`;

  console.log("[Bunny] Copying file to cache:", tempUri);
  
  try {
    await FileSystem.copyAsync({
      from: uri,
      to: tempUri,
    });
    console.log("[Bunny] File copied successfully");
    return tempUri;
  } catch (copyError) {
    console.error("[Bunny] Failed to copy file:", copyError);
    // If copy fails, try using original URI
    return uri;
  }
}

/**
 * Upload a file to Bunny.net Edge Storage
 * Uses expo-file-system for reliable native uploads with fallback to fetch
 *
 * @param uri - Local file URI (file://, content://, ph://)
 * @param folder - Destination folder (e.g., "posts", "events", "stories")
 * @param onProgress - Progress callback
 */
export async function uploadToBunny(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
  userId?: string,
): Promise<UploadResult> {
  const BUNDLE_VERSION = "v6-robust-upload";
  console.log("[Bunny] =========================================");
  console.log("[Bunny] Starting upload (", BUNDLE_VERSION, ")");
  console.log("[Bunny] Original URI:", uri.substring(0, 120));
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

    // Ensure file is accessible (copy to cache if needed)
    let accessibleUri: string;
    try {
      accessibleUri = await ensureFileAccessible(uri);
      console.log("[Bunny] Accessible URI:", accessibleUri.substring(0, 120));
    } catch (accessError) {
      console.error("[Bunny] Failed to make file accessible:", accessError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Cannot access file: ${accessError instanceof Error ? accessError.message : String(accessError)}`,
      };
    }

    // Check if file exists and get info
    console.log("[Bunny] Checking file info...");
    let fileInfo: FileSystem.FileInfo;
    try {
      fileInfo = await FileSystem.getInfoAsync(accessibleUri);
      console.log("[Bunny] File info:", JSON.stringify(fileInfo));
    } catch (infoError) {
      console.error("[Bunny] Failed to get file info:", infoError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Cannot read file info: ${infoError instanceof Error ? infoError.message : String(infoError)}`,
      };
    }

    if (!fileInfo.exists) {
      console.error("[Bunny] File does not exist at:", accessibleUri);
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

    // Try native upload first, then fallback to fetch+blob
    let uploadSuccess = false;
    let uploadError = "";
    let responseStatus = 0;
    let responseBody = "";

    // Method 1: FileSystem.uploadAsync (native, most reliable)
    console.log("[Bunny] Method 1: Trying FileSystem.uploadAsync...");
    try {
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, accessibleUri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "AccessKey": BUNNY_STORAGE_API_KEY,
          "Content-Type": "application/octet-stream",
        },
      });

      responseStatus = uploadResult.status;
      responseBody = uploadResult.body || "";
      console.log("[Bunny] Method 1 response:", responseStatus, responseBody.substring(0, 100));

      if (responseStatus === 201 || responseStatus === 200) {
        uploadSuccess = true;
      } else {
        uploadError = `HTTP ${responseStatus}: ${responseBody}`;
      }
    } catch (nativeError) {
      console.error("[Bunny] Method 1 failed:", nativeError);
      uploadError = nativeError instanceof Error ? nativeError.message : String(nativeError);
      
      // Method 2: Fallback to fetch + blob approach
      console.log("[Bunny] Method 2: Falling back to fetch+blob...");
      try {
        // Read file as base64 first
        const base64 = await FileSystem.readAsStringAsync(accessibleUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log("[Bunny] File read as base64, length:", base64.length);

        // Convert base64 to blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/octet-stream" });
        console.log("[Bunny] Blob created, size:", blob.size);

        // Upload using fetch
        const fetchResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "AccessKey": BUNNY_STORAGE_API_KEY,
            "Content-Type": "application/octet-stream",
          },
          body: blob,
        });

        responseStatus = fetchResponse.status;
        responseBody = await fetchResponse.text();
        console.log("[Bunny] Method 2 response:", responseStatus, responseBody.substring(0, 100));

        if (responseStatus === 201 || responseStatus === 200) {
          uploadSuccess = true;
        } else {
          uploadError = `HTTP ${responseStatus}: ${responseBody}`;
        }
      } catch (fetchError) {
        console.error("[Bunny] Method 2 also failed:", fetchError);
        uploadError = `Both upload methods failed. Native: ${uploadError}. Fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
      }
    }

    if (uploadSuccess) {
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
      console.error("[Bunny] Upload failed:", uploadError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: uploadError,
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
