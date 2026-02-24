/**
 * Image Crop Utilities
 *
 * Deterministic crop math + high-quality bitmap generation.
 * All functions are pure except generateCroppedBitmap.
 *
 * Uses the app's canonical 4:5 portrait aspect ratio from use-responsive-media.
 */

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Image as RNImage } from "react-native";
import { ASPECT_RATIOS } from "@/lib/hooks/use-responsive-media";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";

/** Maximum output width — prevents uploading unnecessarily large images */
export const MAX_CROP_OUTPUT_WIDTH = 1440;

/** Feed post aspect ratio (4:5 portrait) — single source of truth */
export const CROP_ASPECT_RATIO = ASPECT_RATIOS.portrait; // 5 / 4

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface CropState {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Minimum scale where image fully covers the crop frame.
 */
export function calculateMinScale(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
): number {
  return Math.max(frameW / imgW, frameH / imgH);
}

/**
 * Clamp pan so the image always covers the frame (no empty space).
 */
export function clampPan(
  tx: number,
  ty: number,
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  scale: number,
): { x: number; y: number } {
  const dw = imgW * scale;
  const dh = imgH * scale;
  const maxX = Math.max(0, (dw - frameW) / 2);
  const maxY = Math.max(0, (dh - frameH) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, tx)),
    y: Math.min(maxY, Math.max(-maxY, ty)),
  };
}

/**
 * Map the visible crop frame back to original image pixel coordinates.
 */
export function getCropRect(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  scale: number,
  tx: number,
  ty: number,
): CropRect {
  const cropW = frameW / scale;
  const cropH = frameH / scale;
  const cx = imgW / 2 - tx / scale;
  const cy = imgH / 2 - ty / scale;
  const ox = Math.max(0, Math.round(cx - cropW / 2));
  const oy = Math.max(0, Math.round(cy - cropH / 2));
  return {
    originX: ox,
    originY: oy,
    width: Math.min(Math.round(cropW), imgW - ox),
    height: Math.min(Math.round(cropH), imgH - oy),
  };
}

/**
 * Generate a deterministic cropped bitmap.
 * - EXIF orientation handled automatically by expo-image-manipulator
 * - Crops to specified rectangle
 * - Downscales to MAX_CROP_OUTPUT_WIDTH
 * - JPEG 0.9 quality
 */
export async function generateCroppedBitmap(
  uri: string,
  rect: CropRect,
  maxWidth = MAX_CROP_OUTPUT_WIDTH,
): Promise<{ uri: string; width: number; height: number }> {
  const actions: Array<
    | { crop: { originX: number; originY: number; width: number; height: number } }
    | { resize: { width: number } }
  > = [
    {
      crop: {
        originX: rect.originX,
        originY: rect.originY,
        width: rect.width,
        height: rect.height,
      },
    },
  ];
  if (rect.width > maxWidth) {
    actions.push({ resize: { width: maxWidth } });
  }
  const result = await manipulateAsync(uri, actions, {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Get image dimensions (fallback when MediaAsset doesn't have them).
 */
export function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err || new Error("Failed to get image dimensions")),
    );
  });
}

// ── Pending crop bridge (module-level, consumed once) ───────────────
let _pendingMedia: MediaAsset[] | null = null;
let _pendingEditIndex: number | undefined;

export function setPendingCrop(media: MediaAsset[], editIndex?: number) {
  _pendingMedia = media;
  _pendingEditIndex = editIndex;
}

export function consumePendingCrop(): {
  media: MediaAsset[] | null;
  editIndex: number | undefined;
} {
  const result = { media: _pendingMedia, editIndex: _pendingEditIndex };
  _pendingMedia = null;
  _pendingEditIndex = undefined;
  return result;
}
