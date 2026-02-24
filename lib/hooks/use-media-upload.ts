/**
 * React hook for media uploads to Bunny.net CDN
 *
 * CRITICAL RULES:
 * - RAW VIDEO MUST NEVER BE UPLOADED
 * - ALL VIDEOS MUST BE COMPRESSED LOCALLY BEFORE UPLOAD
 * - IF COMPRESSION FAILS → UPLOAD MUST BE BLOCKED
 *
 * Flow for videos:
 * 1. Validate video (duration, size, resolution)
 * 2. Compress using FFmpeg (MANDATORY)
 * 3. Generate thumbnail from original
 * 4. Upload compressed video
 * 5. Upload thumbnail
 * 6. Clean up temp files
 */

import { useState, useCallback } from "react";
import {
  uploadToBunny,
  type UploadProgress,
  type UploadResult,
} from "@/lib/bunny-storage";
import {
  uploadToServer as serverUpload,
  type ServerUploadResult,
} from "@/lib/server-upload";
import {
  generateVideoThumbnail,
  cleanupThumbnail,
} from "@/lib/video-thumbnail";
import {
  compressVideo,
  validateVideo,
  cleanupCompressedVideo,
  type CompressionProgress,
} from "@/lib/video-compression";

// CRITICAL: Use server-side uploads by default to avoid 401 errors
// Direct Bunny uploads expose AccessKey in client which causes failures on Android
const USE_SERVER_UPLOAD = true;

export interface UseMediaUploadOptions {
  folder?: string;
  userId?: string;
  onSuccess?: (results: UploadResult[]) => void;
  onError?: (error: string) => void;
}

export interface MediaFile {
  uri: string;
  type: "image" | "video";
}

export interface MediaUploadResult {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
  success: boolean;
  error?: string;
  compressionStats?: {
    originalSize: number;
    compressedSize: number;
    reductionPercent: number;
  };
}

export function useMediaUpload(options: UseMediaUploadOptions = {}) {
  const { folder = "uploads", userId, onSuccess, onError } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const uploadSingle = useCallback(
    async (uri: string): Promise<UploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      let result: UploadResult;

      if (USE_SERVER_UPLOAD) {
        // Use server-side upload (recommended - no 401 errors)
        console.log("[useMediaUpload] Using server-side upload");
        const serverResult = await serverUpload(uri, folder, (p) => {
          setProgress(p.percentage);
        });
        result = {
          success: serverResult.success,
          url: serverResult.url,
          path: serverResult.path,
          filename: serverResult.filename,
          error: serverResult.error,
        };
      } else {
        // Direct Bunny upload (may fail with 401 on Android)
        console.log("[useMediaUpload] Using direct Bunny upload");
        result = await uploadToBunny(
          uri,
          folder,
          (p) => {
            setProgress(p.percentage);
          },
          userId,
        );
      }

      setIsUploading(false);

      if (result.success) {
        onSuccess?.([result]);
      } else {
        setError(result.error || "Upload failed");
        onError?.(result.error || "Upload failed");
      }

      return result;
    },
    [folder, userId, onSuccess, onError],
  );

  const uploadMultiple = useCallback(
    async (files: MediaFile[]): Promise<MediaUploadResult[]> => {
      setIsUploading(true);
      setProgress(0);
      setCompressionProgress(0);
      setError(null);
      setStatusMessage(null);

      const results: MediaUploadResult[] = [];
      const videoCount = files.filter((f) => f.type === "video").length;
      const imageCount = files.length - videoCount;
      // Videos: validate + compress + thumbnail + upload = 4 steps
      // Images: upload = 1 step
      const totalSteps = videoCount * 4 + imageCount;
      let completedSteps = 0;

      const updateProgress = (message?: string) => {
        completedSteps++;
        setProgress(Math.round((completedSteps / totalSteps) * 100));
        if (message) setStatusMessage(message);
      };

      for (const file of files) {
        console.log(
          "[useMediaUpload] Processing file:",
          file.type,
          file.uri.substring(0, 50),
        );

        if (file.type === "video") {
          // ========== VIDEO PROCESSING (MANDATORY COMPRESSION) ==========
          console.log(
            "[useMediaUpload] ========== VIDEO COMPRESSION PIPELINE ==========",
          );

          // Step 1: Validate video
          setStatusMessage("Validating video...");
          const validation = await validateVideo(file.uri);
          if (!validation.valid) {
            console.error(
              "[useMediaUpload] Video validation failed:",
              validation.errors,
            );
            results.push({
              type: "video",
              url: "",
              success: false,
              error: `Video rejected: ${validation.errors.join(", ")}`,
            });
            // Skip remaining steps for this file
            completedSteps += 4;
            setProgress(Math.round((completedSteps / totalSteps) * 100));
            continue;
          }
          updateProgress("Video validated");

          // Step 2: MANDATORY compression
          setIsCompressing(true);
          setStatusMessage("Compressing video...");
          console.log("[useMediaUpload] Starting MANDATORY video compression");

          const compressionResult = await compressVideo(file.uri, (p) => {
            setCompressionProgress(p.percentage);
          });
          setIsCompressing(false);

          if (!compressionResult.success || !compressionResult.outputPath) {
            // CRITICAL: If compression fails, DO NOT upload raw video
            console.error(
              "[useMediaUpload] COMPRESSION FAILED - BLOCKING UPLOAD",
            );
            console.error("[useMediaUpload] Error:", compressionResult.error);
            results.push({
              type: "video",
              url: "",
              success: false,
              error:
                compressionResult.error ||
                "Video compression failed. Cannot upload raw video.",
            });
            // Skip remaining steps
            completedSteps += 3;
            setProgress(Math.round((completedSteps / totalSteps) * 100));
            continue;
          }

          console.log("[useMediaUpload] Compression SUCCESS:", {
            originalMB: Math.round(
              (compressionResult.originalSize || 0) / 1024 / 1024,
            ),
            compressedMB: Math.round(
              (compressionResult.compressedSize || 0) / 1024 / 1024,
            ),
            reduction: compressionResult.compressionRatio + "%",
          });
          updateProgress("Video compressed");

          // Step 3: Generate thumbnail from ORIGINAL video (non-blocking — upload continues on timeout)
          setStatusMessage("Generating thumbnail...");
          let thumbnailUrl: string | undefined;
          const thumbResult = await generateVideoThumbnail(file.uri, 500, 6000);
          if (thumbResult.success && thumbResult.uri) {
            let thumbUpload: { success: boolean; url: string; error?: string };
            if (USE_SERVER_UPLOAD) {
              const serverResult = await serverUpload(
                thumbResult.uri,
                `${folder}/thumbnails`,
              );
              thumbUpload = {
                success: serverResult.success,
                url: serverResult.url,
                error: serverResult.error,
              };
            } else {
              thumbUpload = await uploadToBunny(
                thumbResult.uri,
                `${folder}/thumbnails`,
                undefined,
                userId,
              );
            }
            if (thumbUpload.success) {
              thumbnailUrl = thumbUpload.url;
              console.log("[useMediaUpload] Thumbnail uploaded:", thumbnailUrl);
            }
            await cleanupThumbnail(thumbResult.uri);
          }
          updateProgress("Thumbnail generated");

          // Step 4: Upload COMPRESSED video (never raw)
          setStatusMessage("Uploading video...");
          let uploadResult: { success: boolean; url: string; error?: string };
          if (USE_SERVER_UPLOAD) {
            const serverResult = await serverUpload(
              compressionResult.outputPath,
              folder,
            );
            uploadResult = {
              success: serverResult.success,
              url: serverResult.url,
              error: serverResult.error,
            };
          } else {
            uploadResult = await uploadToBunny(
              compressionResult.outputPath,
              folder,
              undefined,
              userId,
            );
          }

          // Clean up compressed file after upload
          await cleanupCompressedVideo(compressionResult.outputPath);

          if (!uploadResult.success) {
            console.error(
              "[useMediaUpload] Upload failed:",
              uploadResult.error,
            );
            results.push({
              type: "video",
              url: "",
              success: false,
              error: uploadResult.error,
            });
          } else {
            results.push({
              type: "video",
              url: uploadResult.url,
              thumbnail: thumbnailUrl,
              success: true,
              compressionStats: {
                originalSize: compressionResult.originalSize || 0,
                compressedSize: compressionResult.compressedSize || 0,
                reductionPercent: compressionResult.compressionRatio || 0,
              },
            });
          }
          updateProgress("Upload complete");
          console.log(
            "[useMediaUpload] ========== VIDEO PIPELINE COMPLETE ==========",
          );
        } else {
          // ========== IMAGE PROCESSING (no compression needed) ==========
          setStatusMessage("Uploading image...");
          let uploadResult: { success: boolean; url: string; error?: string };
          if (USE_SERVER_UPLOAD) {
            const serverResult = await serverUpload(file.uri, folder);
            uploadResult = {
              success: serverResult.success,
              url: serverResult.url,
              error: serverResult.error,
            };
          } else {
            uploadResult = await uploadToBunny(
              file.uri,
              folder,
              undefined,
              userId,
            );
          }

          if (!uploadResult.success) {
            results.push({
              type: "image",
              url: "",
              success: false,
              error: uploadResult.error,
            });
          } else {
            results.push({
              type: "image",
              url: uploadResult.url,
              success: true,
            });
          }
          updateProgress("Image uploaded");
        }
      }

      setIsUploading(false);
      setStatusMessage(null);

      const successResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);
      const failedCount = failedResults.length;

      if (failedCount > 0) {
        console.error("[useMediaUpload] Upload failures:", failedResults);
        const errorMsg =
          failedResults[0]?.error || `${failedCount} file(s) failed to upload`;
        setError(errorMsg);
        onError?.(errorMsg);
      }

      if (successResults.length > 0) {
        onSuccess?.(
          successResults.map((r) => ({
            success: true,
            url: r.url,
            path: "",
            filename: "",
          })),
        );
      }

      return results;
    },
    [folder, userId, onSuccess, onError],
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setIsCompressing(false);
    setProgress(0);
    setCompressionProgress(0);
    setError(null);
    setStatusMessage(null);
  }, []);

  // Immediately cancels the upload UI state — use when user taps Cancel on the overlay.
  // The underlying network request will still complete/timeout, but the UI is unblocked.
  const cancelUpload = useCallback(() => {
    setIsUploading(false);
    setIsCompressing(false);
    setProgress(0);
    setCompressionProgress(0);
    setError(null);
    setStatusMessage(null);
  }, []);

  return {
    isUploading,
    isCompressing,
    progress,
    compressionProgress,
    error,
    statusMessage,
    uploadSingle,
    uploadMultiple,
    reset,
    cancelUpload,
  };
}
