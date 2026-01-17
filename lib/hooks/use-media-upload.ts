/**
 * React hook for media uploads to Bunny.net CDN
 */

import { useState, useCallback } from "react";
import {
  uploadToBunny,
  uploadMultipleToBunny,
  type UploadProgress,
  type UploadResult,
} from "@/lib/bunny-storage";

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

export function useMediaUpload(options: UseMediaUploadOptions = {}) {
  const { folder = "uploads", userId, onSuccess, onError } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadSingle = useCallback(
    async (uri: string): Promise<UploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      const result = await uploadToBunny(
        uri,
        folder,
        (p) => {
          setProgress(p.percentage);
        },
        userId,
      );

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
    async (
      files: MediaFile[],
    ): Promise<
      Array<{ type: "image" | "video"; url: string; success: boolean }>
    > => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      const results = await uploadMultipleToBunny(
        files,
        folder,
        (p) => {
          setProgress(p.percentage);
        },
        userId,
      );

      setIsUploading(false);

      const successResults = results.filter((r) => r.success);
      const failedCount = results.length - successResults.length;

      if (failedCount > 0) {
        const errorMsg = `${failedCount} file(s) failed to upload`;
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
    setProgress(0);
    setError(null);
  }, []);

  return {
    isUploading,
    progress,
    error,
    uploadSingle,
    uploadMultiple,
    reset,
  };
}
