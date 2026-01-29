/**
 * Video Compression Utility for Deviant
 *
 * CRITICAL RULES:
 * - RAW VIDEO MUST NEVER BE UPLOADED
 * - ALL VIDEOS MUST BE COMPRESSED LOCALLY BEFORE UPLOAD
 * - IF LOCAL COMPRESSION FAILS → UPLOAD MUST BE BLOCKED
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

import { FFmpegKit, FFmpegKitConfig, ReturnCode } from "ffmpeg-kit-react-native";
import * as LegacyFileSystem from "expo-file-system/legacy";

const FileSystem = LegacyFileSystem;

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
 * Get video metadata using FFprobe
 */
export async function getVideoMetadata(videoUri: string): Promise<VideoMetadata | null> {
  console.log("[VideoCompression] Getting metadata for:", videoUri.substring(0, 80));

  try {
    // Ensure we have a file:// path
    const filePath = videoUri.startsWith("file://") ? videoUri : `file://${videoUri}`;
    const cleanPath = filePath.replace("file://", "");

    // FFprobe command to get video info as JSON
    const command = `-v quiet -print_format json -show_format -show_streams "${cleanPath}"`;

    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      console.error("[VideoCompression] FFprobe failed");
      return null;
    }

    const output = await session.getOutput();
    if (!output) {
      console.error("[VideoCompression] No FFprobe output");
      return null;
    }

    const data = JSON.parse(output);
    const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
    const format = data.format;

    if (!videoStream || !format) {
      console.error("[VideoCompression] Missing video stream or format");
      return null;
    }

    const metadata: VideoMetadata = {
      duration: parseFloat(format.duration) || 0,
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      bitrate: parseInt(format.bit_rate) || 0,
      codec: videoStream.codec_name || "unknown",
      fileSize: parseInt(format.size) || 0,
      fps: eval(videoStream.r_frame_rate) || 30, // e.g., "30/1" -> 30
    };

    console.log("[VideoCompression] Metadata:", metadata);
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
export async function validateVideo(videoUri: string): Promise<ValidationResult> {
  console.log("[VideoCompression] Validating video:", videoUri.substring(0, 80));

  const errors: string[] = [];

  // Check file exists
  const fileInfo = await FileSystem.getInfoAsync(videoUri);
  if (!fileInfo.exists) {
    return { valid: false, errors: ["Video file does not exist"] };
  }

  // Check file size before metadata extraction
  const fileSize = (fileInfo as any).size || 0;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    errors.push(`File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds ${MAX_FILE_SIZE_MB}MB limit`);
  }

  // Get metadata
  const metadata = await getVideoMetadata(videoUri);
  if (!metadata) {
    return { valid: false, errors: ["Could not read video metadata"] };
  }

  // Validate duration
  if (metadata.duration > MAX_DURATION_SECONDS) {
    errors.push(`Duration ${Math.round(metadata.duration)}s exceeds ${MAX_DURATION_SECONDS}s limit`);
  }

  // Validate resolution
  const maxDimension = Math.max(metadata.width, metadata.height);
  if (maxDimension > MAX_RESOLUTION) {
    // This is a warning, not an error - we'll scale it down
    console.log("[VideoCompression] Video will be scaled from", maxDimension, "to", TARGET_WIDTH);
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

  console.log("[VideoCompression] Validation result:", result.valid ? "PASS" : "FAIL", errors);
  return result;
}

/**
 * Compress video using FFmpeg
 * This is the MANDATORY compression step before upload
 */
export async function compressVideo(
  inputUri: string,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<CompressionResult> {
  console.log("[VideoCompression] ==========================================");
  console.log("[VideoCompression] Starting compression");
  console.log("[VideoCompression] Input:", inputUri.substring(0, 80));

  const startTime = Date.now();

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

    // Prepare paths
    const inputPath = inputUri.startsWith("file://") ? inputUri.replace("file://", "") : inputUri;
    const outputFilename = `compressed_${Date.now()}.mp4`;
    const outputPath = `${FileSystem.cacheDirectory}${outputFilename}`;
    const cleanOutputPath = outputPath.replace("file://", "");

    console.log("[VideoCompression] Output:", cleanOutputPath);
    console.log("[VideoCompression] Original size:", Math.round(originalSize / 1024 / 1024), "MB");

    // Calculate scaling
    // Prefer 720p, preserve aspect ratio, ensure even dimensions
    const scaleFilter = `scale='min(${TARGET_WIDTH},iw)':-2`;

    // FFmpeg command matching the spec exactly
    const command = [
      `-i "${inputPath}"`,
      `-vf "${scaleFilter}"`,
      `-c:v libx264`,
      `-profile:v main`,
      `-level 4.1`,
      `-pix_fmt yuv420p`,
      `-b:v ${TARGET_BITRATE}`,
      `-maxrate ${TARGET_MAX_BITRATE}`,
      `-bufsize ${TARGET_BUFFER_SIZE}`,
      `-r ${TARGET_FPS}`,
      `-movflags +faststart`,
      `-c:a aac`,
      `-b:a ${TARGET_AUDIO_BITRATE}`,
      `-ac 2`,
      `-y`, // Overwrite output
      `"${cleanOutputPath}"`,
    ].join(" ");

    console.log("[VideoCompression] FFmpeg command:", command);

    // Set up progress callback
    if (onProgress) {
      FFmpegKitConfig.enableStatisticsCallback((stats) => {
        const time = stats.getTime();
        const duration = metadata.duration * 1000; // Convert to ms
        const percentage = duration > 0 ? Math.min(100, Math.round((time / duration) * 100)) : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = percentage > 0 ? (elapsed * 100) / percentage : undefined;
        const remaining = estimatedTotal ? estimatedTotal - elapsed : undefined;

        onProgress({
          percentage,
          timeElapsed: elapsed,
          estimatedTimeRemaining: remaining,
        });
      });
    }

    // Execute compression
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    // Check result
    if (!ReturnCode.isSuccess(returnCode)) {
      const logs = await session.getLogsAsString();
      console.error("[VideoCompression] FFmpeg failed:", logs?.substring(0, 500));
      return {
        success: false,
        error: "Video compression failed. Please try a different video.",
      };
    }

    // Verify output exists and get size
    const outputInfo = await FileSystem.getInfoAsync(outputPath);
    if (!outputInfo.exists) {
      console.error("[VideoCompression] Output file not created");
      return {
        success: false,
        error: "Compression completed but output file not found",
      };
    }

    const compressedSize = (outputInfo as any).size || 0;
    const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

    console.log("[VideoCompression] ==========================================");
    console.log("[VideoCompression] Compression SUCCESS");
    console.log("[VideoCompression] Original:", Math.round(originalSize / 1024 / 1024), "MB");
    console.log("[VideoCompression] Compressed:", Math.round(compressedSize / 1024 / 1024), "MB");
    console.log("[VideoCompression] Reduction:", compressionRatio, "%");
    console.log("[VideoCompression] Duration:", Math.round((Date.now() - startTime) / 1000), "s");
    console.log("[VideoCompression] ==========================================");

    return {
      success: true,
      outputPath,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("[VideoCompression] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown compression error",
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
