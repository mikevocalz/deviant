/**
 * React hook for media uploads to Payload CMS (temporary - will migrate to Bunny.net later)
 */

import { useState, useCallback } from "react";
import {
  uploadToPayload,
  uploadMultipleToPayload,
  type UploadProgress,
  type UploadResult,
} from "@/lib/payload-media";

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

      const result = await uploadToPayload(
        uri,
        folder,
        (p) => {
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

      const results = await uploadMultipleToPayload(
        files,
        folder,
        (p) => {
          setProgress(p.percentage);
        },
        userId,
      );

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
  };
}
