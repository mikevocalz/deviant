/**
 * Server-side Media Upload Client
 * 
 * CRITICAL: All media uploads go through the backend server.
 * The Bunny Storage AccessKey is NEVER exposed to the client.
 * 
 * This replaces direct Bunny uploads with server-mediated uploads.
 */

import * as FileSystem from "expo-file-system/legacy";
import { getPayloadBaseUrl } from "@/lib/api-config";
import { getAuthCookies } from "@/lib/auth-client";
import { Platform } from "react-native";

const PAYLOAD_URL = getPayloadBaseUrl();

export interface ServerUploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload a file to the server which handles Bunny CDN upload
 * 
 * @param uri - Local file URI (file://, ph://, content://)
 * @param folder - Destination folder (avatars, posts, stories, etc.)
 * @param onProgress - Optional progress callback
 */
export async function uploadToServer(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
): Promise<ServerUploadResult> {
  console.log("[ServerUpload] Starting upload:", { uri: uri.substring(0, 60), folder });

  try {
    // Get auth cookies/token
    const cookies = getAuthCookies();
    if (!cookies) {
      console.error("[ServerUpload] No auth cookies available");
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: "Not authenticated",
      };
    }

    // Report initial progress
    onProgress?.({ loaded: 0, total: 100, percentage: 0 });

    // Read file as base64
    let base64Data: string;
    let mimeType = "image/jpeg";

    // Determine mime type from extension
    const ext = uri.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
      mp4: "video/mp4",
      mov: "video/quicktime",
    };
    if (ext && mimeMap[ext]) {
      mimeType = mimeMap[ext];
    }

    // Ensure file is accessible - copy if needed
    let accessibleUri = uri;
    if (uri.startsWith("ph://") || uri.startsWith("content://") || uri.startsWith("assets-library://")) {
      console.log("[ServerUpload] Copying to cache:", uri.substring(0, 50));
      const cacheUri = FileSystem.cacheDirectory + `upload-${Date.now()}.${ext || "jpg"}`;
      await FileSystem.copyAsync({ from: uri, to: cacheUri });
      accessibleUri = cacheUri;
    }

    // Read as base64
    base64Data = await FileSystem.readAsStringAsync(accessibleUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log("[ServerUpload] Base64 length:", base64Data.length);
    onProgress?.({ loaded: 30, total: 100, percentage: 30 });

    // Upload to server
    const uploadUrl = `${PAYLOAD_URL}/api/media/upload`;
    console.log("[ServerUpload] Uploading to:", uploadUrl);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        data: base64Data,
        mimeType,
        folder,
      }),
    });

    onProgress?.({ loaded: 80, total: 100, percentage: 80 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ServerUpload] Upload failed:", response.status, errorText);
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: `Upload failed: ${response.status}`,
      };
    }

    const result = await response.json();
    console.log("[ServerUpload] Upload success:", result.url);

    onProgress?.({ loaded: 100, total: 100, percentage: 100 });

    return {
      success: true,
      url: result.url,
      path: result.path || "",
      filename: result.filename || "",
    };
  } catch (error) {
    console.error("[ServerUpload] Error:", error);
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload multiple files to server
 */
export async function uploadMultipleToServer(
  files: Array<{ uri: string; type: "image" | "video" }>,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
): Promise<Array<{ type: "image" | "video"; url: string; success: boolean; error?: string }>> {
  const results: Array<{ type: "image" | "video"; url: string; success: boolean; error?: string }> = [];
  const totalFiles = files.length;
  let completedFiles = 0;

  for (const file of files) {
    const result = await uploadToServer(
      file.uri,
      folder,
      (fileProgress) => {
        if (onProgress) {
          const fileContribution = fileProgress.percentage / totalFiles;
          const completedContribution = (completedFiles / totalFiles) * 100;
          onProgress({
            loaded: completedFiles + fileProgress.percentage / 100,
            total: totalFiles,
            percentage: Math.round(completedContribution + fileContribution),
          });
        }
      },
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
 * Check if server upload is available
 */
export async function checkUploadConfig(): Promise<{
  configured: boolean;
  cdnUrl: string;
  maxSizeMB: number;
}> {
  try {
    const cookies = getAuthCookies();
    const response = await fetch(`${PAYLOAD_URL}/api/media/upload-config`, {
      headers: cookies ? { Cookie: cookies } : {},
    });

    if (!response.ok) {
      return { configured: false, cdnUrl: "", maxSizeMB: 0 };
    }

    return await response.json();
  } catch {
    return { configured: false, cdnUrl: "", maxSizeMB: 0 };
  }
}
