/**
 * Export Pipeline — expo-image-manipulator ONLY (NO SKIA).
 *
 * Replays the non-destructive EditState as manipulator actions:
 *   1. Rotate (rotate90 + straighten combined)
 *   2. Flip horizontal (if flipX)
 *   3. Crop (rect computed in post-rotate/flip space)
 *   4. Resize (maxEdge, preserve aspect)
 *   5. Save (quality + format)
 *
 * CRITICAL: The action order MUST match what computeCropRectPixels expects.
 */

import {
  manipulateAsync,
  FlipType,
  SaveFormat,
  type Action,
} from "expo-image-manipulator";
import type { EditState } from "./edit-state";
import { computeCropRectPixels } from "./crop-math";

export interface ExportResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Map our format string to expo-image-manipulator SaveFormat.
 */
function toSaveFormat(fmt: string): SaveFormat {
  switch (fmt) {
    case "png":
      return SaveFormat.PNG;
    case "webp":
      return SaveFormat.WEBP;
    default:
      return SaveFormat.JPEG;
  }
}

/**
 * Export the edited image. All pixel work happens here — never during gestures.
 *
 * @param state       Current EditState with all params
 * @param cropFrameW  Width of the crop frame on screen (pixels)
 * @param cropFrameH  Height of the crop frame on screen (pixels)
 * @param viewScale   Current gesture scale (from shared value)
 * @param viewTx      Current gesture translateX (from shared value)
 * @param viewTy      Current gesture translateY (from shared value)
 */
export async function exportImage(
  state: EditState,
  cropFrameW: number,
  cropFrameH: number,
  viewScale: number,
  viewTx: number,
  viewTy: number,
): Promise<ExportResult> {
  const actions: Action[] = [];

  // ── 1. Rotate ──────────────────────────────────────────────────────
  // Combine rotate90 + straighten into a single rotate action.
  const totalRotation = state.rotate90 + state.straighten;
  if (totalRotation !== 0) {
    actions.push({ rotate: totalRotation });
  }

  // ── 2. Flip ────────────────────────────────────────────────────────
  if (state.flipX) {
    actions.push({ flip: FlipType.Horizontal });
  }

  // ── 3. Crop ────────────────────────────────────────────────────────
  // Compute crop rect in the post-rotate/flip coordinate space.
  const cropRect = computeCropRectPixels({
    sourceW: state.sourceSize.w,
    sourceH: state.sourceSize.h,
    containerW: cropFrameW,
    containerH: cropFrameH,
    cropFrameW,
    cropFrameH,
    scale: viewScale,
    tx: viewTx,
    ty: viewTy,
    rotate90: state.rotate90,
    straighten: state.straighten,
    flipX: state.flipX,
  });

  actions.push({
    crop: {
      originX: cropRect.originX,
      originY: cropRect.originY,
      width: cropRect.width,
      height: cropRect.height,
    },
  });

  // ── 4. Resize ──────────────────────────────────────────────────────
  if (state.output.maxEdge) {
    const maxEdge = state.output.maxEdge;
    // Only resize if the crop result exceeds maxEdge
    if (cropRect.width > maxEdge || cropRect.height > maxEdge) {
      if (cropRect.width >= cropRect.height) {
        actions.push({ resize: { width: maxEdge } });
      } else {
        actions.push({ resize: { height: maxEdge } });
      }
    }
  }

  // ── 5. Save ────────────────────────────────────────────────────────
  const result = await manipulateAsync(state.sourceUri, actions, {
    compress: state.output.quality,
    format: toSaveFormat(state.output.format),
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
