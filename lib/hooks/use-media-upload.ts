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
  uploadToServer as serverUpload,
  type ServerUploadResult,
  type UploadProgress,
} from "@/lib/server-upload";

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  compressVideo,
  validateVideo,
  cleanupCompressedVideo,
  type CompressionProgress,
} from "@/lib/video-compression";

export type UploadResult = ServerUploadResult;

export interface UseMediaUploadOptions {
  folder?: string;
  userId?: string;
  onSuccess?: (results: ServerUploadResult[]) => void;
  onError?: (error: string) => void;
}

export interface MediaFile {
  uri: string;
  type: "image" | "video";
  kind?: import("@/lib/media/types").MediaKind;
  mimeType?: string;
  pairedVideoUri?: string; // Live Photo paired video (iOS)
}

export interface MediaUploadResult {
  type: "image" | "video";
  kind?: import("@/lib/media/types").MediaKind;
  url: string;
  thumbnail?: string;
  mimeType?: string;
  livePhotoVideoUrl?: string;
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

      const result = await serverUpload(uri, folder, (p) => {
        setProgress(p.percentage);
      });

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
      // All uploads: validate + compress + upload = 3 steps per video
      // Thumbnail generation disabled — expo-video-thumbnails hangs on iOS 26.3
      const isStory = folder === "stories";
      const videoSteps = 3;
      const totalSteps = videoCount * videoSteps + imageCount;
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
            completedSteps += videoSteps;
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
            completedSteps += videoSteps - 1;
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

          // Thumbnail generation DISABLED — expo-video-thumbnails hangs on iOS 26.3
          // Video player renders first frame automatically. Can re-enable with
          // react-native-compressor's createVideoThumbnail later.
          const thumbnailUrl: string | undefined = undefined;

          // Step 4: Upload COMPRESSED video (never raw)
          setStatusMessage("Uploading video...");
          const uploadResult = await serverUpload(
            compressionResult.outputPath,
            folder,
          );

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
        } else if (file.kind === "gif") {
          // ========== GIF PROCESSING (NO compression — would destroy frames) ==========
          console.log("[useMediaUpload] GIF detected — skipping compression");
          setStatusMessage("Uploading GIF...");
          const uploadResult = await serverUpload(file.uri, folder);
          if (!uploadResult.success) {
            results.push({
              type: "image",
              kind: "gif",
              url: "",
              success: false,
              error: uploadResult.error,
              mimeType: "image/gif",
            });
          } else {
            results.push({
              type: "image",
              kind: "gif",
              url: uploadResult.url,
              success: true,
              mimeType: "image/gif",
            });
          }
          updateProgress("GIF uploaded");
        } else if (file.kind === "livePhoto" && file.pairedVideoUri) {
          // ========== LIVE PHOTO PROCESSING (upload still + paired video) ==========
          console.log(
            "[useMediaUpload] Live Photo detected — uploading still + paired video",
          );
          setStatusMessage("Uploading Live Photo...");

          // Upload the still image
          let stillUri = file.uri;
          try {
            const compressed = await manipulateAsync(
              file.uri,
              [{ resize: { width: 1440 } }],
              { compress: 0.85, format: SaveFormat.JPEG },
            );
            stillUri = compressed.uri;
          } catch {
            // fall back to original if compression fails
          }
          const stillResult = await serverUpload(stillUri, folder);

          // Upload the paired video (no compression — short clip, Live Photo quality must be preserved)
          setStatusMessage("Uploading Live Photo video...");
          const videoResult = await serverUpload(file.pairedVideoUri, folder);

          if (!stillResult.success) {
            results.push({
              type: "image",
              kind: "livePhoto",
              url: "",
              success: false,
              error: stillResult.error,
            });
          } else {
            results.push({
              type: "image",
              kind: "livePhoto",
              url: stillResult.url,
              livePhotoVideoUrl: videoResult.success
                ? videoResult.url
                : undefined,
              mimeType: file.mimeType,
              success: true,
            });
          }
          updateProgress("Live Photo uploaded");
        } else {
          // ========== IMAGE PROCESSING (compress + upload) ==========
          setStatusMessage("Optimizing image...");
          let imageUri = file.uri;
          try {
            const compressed = await manipulateAsync(
              file.uri,
              [{ resize: { width: 1440 } }],
              { compress: 0.85, format: SaveFormat.JPEG },
            );
            imageUri = compressed.uri;
            console.log(
              "[useMediaUpload] Image optimized:",
              imageUri.substring(0, 50),
            );
          } catch (compressErr) {
            console.warn(
              "[useMediaUpload] Image optimization failed, using original:",
              compressErr,
            );
          }

          setStatusMessage("Uploading image...");
          const uploadResult = await serverUpload(imageUri, folder);

          if (!uploadResult.success) {
            results.push({
              type: "image",
              kind: "image",
              url: "",
              success: false,
              error: uploadResult.error,
            });
          } else {
            results.push({
              type: "image",
              kind: "image",
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
