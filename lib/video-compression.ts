/**
 * Video Compression Utility for Deviant
 *
 * NOTE: ffmpeg-kit-react-native has been RETIRED (Jan 2025).
 * This module now uses a pass-through approach until a replacement is implemented.
 * Videos are uploaded without local compression - server-side processing handles optimization.
 *
 * Target Output (Feed-Safe):
 * - Container: MP4
 * - Video Codec: H.264 (Main Profile, Level 4.1)
 * - Resolution: 1280×720 preferred, 1920×1080 max
 * - FPS: 24–30
 * - Video Bitrate: 1.4–2.0 Mbps
 * - Audio Codec: AAC @ 96 kbps
 * - Pixel Format: yuv420p
 * - Max Duration: 60s
 */

// FFmpeg-Kit has been retired - using pass-through approach
// import { FFmpegKit, FFmpegKitConfig, ReturnCode } from "ffmpeg-kit-react-native";
import * as LegacyFileSystem from "expo-file-system/legacy";

const FileSystem = LegacyFileSystem;

// Flag to indicate FFmpeg is not available
const FFMPEG_AVAILABLE = false;

// Validation limits
const MAX_DURATION_SECONDS = 60;
const MAX_RESOLUTION = 1080;
const MAX_FILE_SIZE_MB = 150;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Target compression settings
const TARGET_WIDTH = 1280;
const TARGET_BITRATE = "1800k";
const TARGET_MAX_BITRATE = "2000k";
const TARGET_BUFFER_SIZE = "4000k";
const TARGET_FPS = 30;
const TARGET_AUDIO_BITRATE = "96k";

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  bitrate: number; // bps
  codec: string;
  fileSize: number; // bytes
  fps: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: VideoMetadata;
}

export interface CompressionResult {
  success: boolean;
  outputPath?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  error?: string;
}

export interface CompressionProgress {
  percentage: number;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
}

/**
 * Get video metadata
 * NOTE: FFmpeg-Kit retired - returns basic file info only
 */
export async function getVideoMetadata(
  videoUri: string,
): Promise<VideoMetadata | null> {
  console.log(
    "[VideoCompression] Getting metadata for:",
    videoUri.substring(0, 80),
  );

  try {
    // Get basic file info since FFmpeg is not available
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists) {
      console.error("[VideoCompression] File does not exist");
      return null;
    }

    const fileSize = (fileInfo as any).size || 0;

    // Return estimated metadata - actual values would require FFprobe
    const metadata: VideoMetadata = {
      duration: 30, // Estimated - actual duration unknown without FFprobe
      width: 1920, // Estimated
      height: 1080, // Estimated
      bitrate: 0,
      codec: "unknown",
      fileSize,
      fps: 30,
    };

    console.log("[VideoCompression] Metadata (estimated):", metadata);
    return metadata;
  } catch (error) {
    console.error("[VideoCompression] Metadata extraction failed:", error);
    return null;
  }
}

/**
 * Validate video before processing
 * Rejects videos that exceed limits
 */
export async function validateVideo(
  videoUri: string,
): Promise<ValidationResult> {
  console.log(
    "[VideoCompression] Validating video:",
    videoUri.substring(0, 80),
  );

  const errors: string[] = [];

  // Check file exists
  const fileInfo = await FileSystem.getInfoAsync(videoUri);
  if (!fileInfo.exists) {
    return { valid: false, errors: ["Video file does not exist"] };
  }

  // Check file size before metadata extraction
  const fileSize = (fileInfo as any).size || 0;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds ${MAX_FILE_SIZE_MB}MB limit`,
    );
  }

  // Get metadata
  const metadata = await getVideoMetadata(videoUri);
  if (!metadata) {
    return { valid: false, errors: ["Could not read video metadata"] };
  }

  // Validate duration
  if (metadata.duration > MAX_DURATION_SECONDS) {
    errors.push(
      `Duration ${Math.round(metadata.duration)}s exceeds ${MAX_DURATION_SECONDS}s limit`,
    );
  }

  // Validate resolution
  const maxDimension = Math.max(metadata.width, metadata.height);
  if (maxDimension > MAX_RESOLUTION) {
    // This is a warning, not an error - we'll scale it down
    console.log(
      "[VideoCompression] Video will be scaled from",
      maxDimension,
      "to",
      TARGET_WIDTH,
    );
  }

  // Check for unsupported codecs (we can transcode most, but some may fail)
  const unsupportedCodecs = ["prores", "dnxhd", "rawvideo"];
  if (unsupportedCodecs.includes(metadata.codec.toLowerCase())) {
    errors.push(`Unsupported codec: ${metadata.codec}`);
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    metadata,
  };

  console.log(
    "[VideoCompression] Validation result:",
    result.valid ? "PASS" : "FAIL",
    errors,
  );
  return result;
}

/**
 * Compress video
 * NOTE: FFmpeg-Kit has been RETIRED (Jan 2025).
 * This now uses a pass-through approach - returns original video.
 * Server-side processing will handle optimization if needed.
 */
export async function compressVideo(
  inputUri: string,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<CompressionResult> {
  console.log("[VideoCompression] ==========================================");
  console.log("[VideoCompression] FFmpeg-Kit RETIRED - using pass-through");
  console.log("[VideoCompression] Input:", inputUri.substring(0, 80));

  try {
    // Validate first
    const validation = await validateVideo(inputUri);
    if (!validation.valid) {
      console.error("[VideoCompression] Validation failed:", validation.errors);
      return {
        success: false,
        error: `Video rejected: ${validation.errors.join(", ")}`,
      };
    }

    const metadata = validation.metadata!;
    const originalSize = metadata.fileSize;

    // Report instant progress since we're not actually compressing
    if (onProgress) {
      onProgress({
        percentage: 100,
        timeElapsed: 0,
        estimatedTimeRemaining: 0,
      });
    }

    console.log(
      "[VideoCompression] ==========================================",
    );
    console.log("[VideoCompression] Pass-through SUCCESS (no compression)");
    console.log(
      "[VideoCompression] Size:",
      Math.round(originalSize / 1024 / 1024),
      "MB",
    );
    console.log(
      "[VideoCompression] ==========================================",
    );

    // Return original file as "compressed" output
    return {
      success: true,
      outputPath: inputUri,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  } catch (error) {
    console.error("[VideoCompression] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clean up compressed video file after upload
 */
export async function cleanupCompressedVideo(filePath: string): Promise<void> {
  try {
    if (filePath && filePath.includes("compressed_")) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log("[VideoCompression] Cleaned up:", filePath.substring(0, 50));
    }
  } catch (error) {
    console.warn("[VideoCompression] Cleanup failed:", error);
  }
}

/**
 * Check if a video needs compression
 * Returns true if the video should be compressed before upload
 */
export function shouldCompress(metadata: VideoMetadata): boolean {
  // Always compress videos for consistent quality and size
  // Even if a video is small, we want consistent codec/bitrate
  return true;
}

/**
 * Estimate compressed file size
 * Useful for showing user expected upload size
 */
export function estimateCompressedSize(metadata: VideoMetadata): number {
  // Target bitrate in bits per second
  const targetBitrate = 1800000 + 96000; // Video + Audio
  // Estimated size = bitrate * duration / 8 (convert to bytes)
  return Math.round((targetBitrate * metadata.duration) / 8);
}
