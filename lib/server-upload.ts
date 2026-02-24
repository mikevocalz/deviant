/**
 * Media Upload Client
 *
 * Uploads files through the media-upload Edge Function.
 * Bunny CDN credentials are NEVER exposed to the client.
 */

import * as LegacyFileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getAuthToken } from "@/lib/auth-client";

const FileSystem = LegacyFileSystem;

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://npfjanxturvmjyevoyfo.supabase.co";
const MEDIA_UPLOAD_URL = `${SUPABASE_URL}/functions/v1/media-upload`;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ServerUploadResult {
  success: boolean;
  url: string;
  path: string;
  filename: string;
  error?: string;
}

/**
 * Map folder name to media-upload edge function "kind" parameter.
 */
function folderToKind(folder: string): string {
  const map: Record<string, string> = {
    avatars: "avatar",
    posts: "post-image",
    stories: "story-image",
    events: "event-image",
    "events/covers": "event-cover",
    chat: "message-image",
    uploads: "post-image",
  };
  // Check for thumbnail subfolders
  if (folder.includes("thumbnails")) return "post-image";
  return map[folder] || "post-image";
}

/**
 * Get mime type from file extension
 */
function getMimeFromUri(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return mimeMap[ext] || "image/jpeg";
}

/**
 * Ensure file is accessible — copy ph:// or content:// URIs to cache
 */
async function ensureFileAccessible(uri: string): Promise<string> {
  if (uri.startsWith("file://")) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }

  if (
    uri.startsWith("ph://") ||
    uri.startsWith("content://") ||
    uri.startsWith("assets-library://")
  ) {
    const ext = uri.split(".").pop() || "jpg";
    const cacheUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    return cacheUri;
  }

  return uri;
}

/**
 * Upload a file via the media-upload Edge Function.
 * Bunny credentials stay server-side.
 */
export async function uploadToServer(
  uri: string,
  folder: string = "uploads",
  onProgress?: (progress: UploadProgress) => void,
): Promise<ServerUploadResult> {
  console.log("[ServerUpload] Starting upload via Edge Function:", {
    uri: uri.substring(0, 60),
    folder,
  });

  try {
    // Get auth token
    const authToken = await getAuthToken();
    if (!authToken) {
      return {
        success: false,
        url: "",
        path: "",
        filename: "",
        error: "Not authenticated — cannot upload",
      };
    }

    // Ensure file is accessible
    const accessibleUri = await ensureFileAccessible(uri);

    // Determine mime type and kind
    const mime = getMimeFromUri(accessibleUri);
    const kind = folderToKind(folder);
    const filename = accessibleUri.split("/").pop() || "upload";

    onProgress?.({ loaded: 0, total: 100, percentage: 10 });

    // Upload via FileSystem.uploadAsync (multipart form)
    const uploadResult = await FileSystem.uploadAsync(
      MEDIA_UPLOAD_URL,
      accessibleUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        parameters: {
          kind,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );

    onProgress?.({ loaded: 80, total: 100, percentage: 80 });

    const body = JSON.parse(uploadResult.body);

    if (uploadResult.status === 200 && body.ok) {
      onProgress?.({ loaded: 100, total: 100, percentage: 100 });
      console.log("[ServerUpload] Success:", body.media?.url);
      return {
        success: true,
        url: body.media.url,
        path: body.media.key || "",
        filename: body.media.key?.split("/").pop() || "",
      };
    }

    const errorMsg =
      body.error || `Upload failed (status ${uploadResult.status})`;
    console.error("[ServerUpload] Failed:", errorMsg);
    return {
      success: false,
      url: "",
      path: "",
      filename: "",
      error: errorMsg,
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
  const cdnUrl =
    process.env.EXPO_PUBLIC_BUNNY_CDN_URL || "https://dvnt.b-cdn.net";
  return {
    configured: true,
    cdnUrl,
    maxSizeMB: 25,
  };
}
