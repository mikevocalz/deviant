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
  console.log("[Bunny] Starting upload for:", uri.substring(0, 100));
  console.log("[Bunny] Config check:", {
    zone: BUNNY_STORAGE_ZONE ? "set" : "MISSING",
    key: BUNNY_STORAGE_API_KEY ? `set (${BUNNY_STORAGE_API_KEY.substring(0, 8)}...)` : "MISSING",
    region: BUNNY_STORAGE_REGION,
    cdnUrl: BUNNY_CDN_URL ? "set" : "MISSING",
  });

  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_API_KEY) {
    console.error("[Bunny] Storage not configured - missing zone or API key");
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
    console.log("[Bunny] Upload URL:", uploadUrl);
    console.log("[Bunny] Storage zone:", BUNNY_STORAGE_ZONE);
    console.log("[Bunny] Region:", BUNNY_STORAGE_REGION);
    console.log("[Bunny] API key prefix:", BUNNY_STORAGE_API_KEY?.substring(0, 12) || "MISSING");

    // Read file as blob
    console.log("[Bunny] Step 1: Fetching local file from URI:", uri);
    let response: Response;
    let blob: Blob;
    let totalSize: number;
    
    try {
      response = await fetch(uri);
      console.log("[Bunny] Step 1a: fetch() returned, ok:", response.ok, "status:", response.status);
    } catch (fetchError) {
      console.error("[Bunny] Step 1 FAILED - fetch() threw:", fetchError);
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Local file fetch failed: ${errMsg}`,
      };
    }
    
    if (!response.ok) {
      console.error("[Bunny] Failed to read local file:", response.status, response.statusText);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Failed to read file: ${response.status}`,
      };
    }
    
    try {
      console.log("[Bunny] Step 2: Converting response to blob...");
      blob = await response.blob();
      totalSize = blob.size;
      console.log("[Bunny] Step 2 complete: size:", totalSize, "bytes, type:", blob.type);
    } catch (blobError) {
      console.error("[Bunny] Step 2 FAILED - blob() threw:", blobError);
      const errMsg = blobError instanceof Error ? blobError.message : String(blobError);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Blob conversion failed: ${errMsg}`,
      };
    }

    if (totalSize === 0) {
      console.error("[Bunny] File is empty (0 bytes)");
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: "File is empty",
      };
    }

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
        console.log("[Bunny] XHR load event, status:", xhr.status, "response:", xhr.responseText?.substring(0, 200));
        
        if (xhr.status === 201 || xhr.status === 200) {
          // Construct CDN URL
          const cdnUrl = BUNNY_CDN_URL
            ? `${BUNNY_CDN_URL}/${path}`
            : `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${path}`;

          console.log("[Bunny] Upload successful, CDN URL:", cdnUrl);
          resolve({
            success: true,
            url: cdnUrl,
            path,
            filename,
          });
        } else {
          console.error("[Bunny] Upload failed with status:", xhr.status, xhr.statusText, xhr.responseText);
          resolve({
            success: false,
            url: "",
            path: "",
            filename: "",
            error: `Upload failed: ${xhr.status} ${xhr.statusText || ""} - ${xhr.responseText || "No response"}`,
          });
        }
      });

      xhr.addEventListener("error", (event) => {
        console.error("[Bunny] Step 3 FAILED - XHR error event");
        console.error("[Bunny] XHR readyState:", xhr.readyState);
        console.error("[Bunny] XHR status:", xhr.status);
        console.error("[Bunny] XHR statusText:", xhr.statusText);
        console.error("[Bunny] XHR responseURL:", xhr.responseURL);
        console.error("[Bunny] XHR responseType:", xhr.responseType);
        console.error("[Bunny] Upload URL was:", uploadUrl);
        resolve({
          success: false,
          url: "",
          path: "",
          filename: "",
          error: `XHR network error (readyState: ${xhr.readyState}, status: ${xhr.status}, url: ${uploadUrl})`,
        });
      });

      xhr.addEventListener("abort", () => {
        console.error("[Bunny] XHR aborted");
        resolve({
          success: false,
          url: "",
          path: "",
          filename: "",
          error: "Upload aborted",
        });
      });

      xhr.addEventListener("timeout", () => {
        console.error("[Bunny] XHR timeout");
        resolve({
          success: false,
          url: "",
          path: "",
          filename: "",
          error: "Upload timeout",
        });
      });

      console.log("[Bunny] Step 3: Starting XHR upload...");
      console.log("[Bunny] XHR PUT to:", uploadUrl);
      console.log("[Bunny] Blob size:", totalSize, "bytes");
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("AccessKey", BUNNY_STORAGE_API_KEY);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.timeout = 120000; // 2 minute timeout for large files
      console.log("[Bunny] XHR headers set, sending blob...");
      xhr.send(blob);
      console.log("[Bunny] XHR send() called, waiting for response...");
    });
  } catch (error) {
    console.error("[Bunny] Upload exception:", error);
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
