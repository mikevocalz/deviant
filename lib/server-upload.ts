/**
 * Media Upload Client
 *
 * Uses Bunny CDN for media storage directly.
 * This replaces the previous server-mediated uploads.
 */

import {
  uploadToBunny,
  type UploadResult,
  type UploadProgress,
} from "@/lib/bunny-storage";

export interface ServerUploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

export { type UploadProgress };

/**
 * Upload a file to Bunny CDN
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
  console.log("[ServerUpload] Starting upload via Bunny CDN:", {
    uri: uri.substring(0, 60),
    folder,
  });

  try {
    const result = await uploadToBunny(uri, folder, onProgress);
    return result;
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
 * Upload multiple files
 */
export async function uploadMultipleToServer(
  files: Array<{ uri: string; type: "image" | "video" }>,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
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
    const result = await uploadToServer(file.uri, folder, (fileProgress) => {
      if (onProgress) {
        const fileContribution = fileProgress.percentage / totalFiles;
        const completedContribution = (completedFiles / totalFiles) * 100;
        onProgress({
          loaded: completedFiles + fileProgress.percentage / 100,
          total: totalFiles,
          percentage: Math.round(completedContribution + fileContribution),
        });
      }
    });

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
 * Check if upload is available
 */
export async function checkUploadConfig(): Promise<{
  configured: boolean;
  cdnUrl: string;
  maxSizeMB: number;
}> {
  // Bunny CDN is always configured via env vars
  const cdnUrl =
    process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";
  return {
    configured: true,
    cdnUrl,
    maxSizeMB: 100, // Bunny supports large files
  };
}
