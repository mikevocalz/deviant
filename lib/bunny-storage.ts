/**
 * Bunny.net Edge Storage API Client
 *
 * Handles media uploads to Bunny.net CDN
 * Docs: https://docs.bunny.net/reference/storage-api
 */

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
  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    console.error("[Bunny] Missing storage configuration");
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: "Storage not configured",
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

    // Read file as blob
    const response = await fetch(uri);
    const blob = await response.blob();
    const totalSize = blob.size;

    // Upload with XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 201 || xhr.status === 200) {
          // Construct CDN URL
          const cdnUrl = BUNNY_CDN_URL
            ? `${BUNNY_CDN_URL}/${path}`
            : `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${path}`;

          resolve({
            success: true,
            url: cdnUrl,
            path,
            filename,
          });
        } else {
          console.error("[Bunny] Upload failed:", xhr.status, xhr.responseText);
          resolve({
            success: false,
            url: "",
            path: "",
            filename: "",
            error: `Upload failed: ${xhr.status}`,
          });
        }
      });

      xhr.addEventListener("error", () => {
        console.error("[Bunny] Upload error");
        resolve({
          success: false,
          url: "",
          path: "",
          filename: "",
          error: "Network error",
        });
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("AccessKey", BUNNY_STORAGE_API_KEY);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(blob);
    });
  } catch (error) {
    console.error("[Bunny] Upload error:", error);
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
): Promise<Array<{ type: "image" | "video"; url: string; success: boolean }>> {
  const results: Array<{
    type: "image" | "video";
    url: string;
    success: boolean;
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
