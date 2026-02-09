/**
 * AppSheet — Standardized TrueSheet navigator wrapper.
 *
 * Uses the official TrueSheet API:
 * - `detents` for height control (NOT maxHeight/snapPoints)
 * - `grabber` + `grabberOptions` for white drag handle
 * - `cornerRadius` for rounded corners
 * - `scrollable` for proper scroll behavior
 *
 * Variants:
 * - AppSheet (default): general-purpose, detents=[0.75]
 * - CommentSheet: comment-specific, detents=[0.7], never full-screen
 */

import type { ReactElement } from "react";
import TrueSheetNavigator from "@/components/navigation/true-sheet-navigator";

/** Shared grabber config — white, 48×6, 10px top margin */
const GRABBER_OPTIONS = {
  width: 48,
  height: 6,
  topMargin: 10,
  color: "#FFFFFF",
} as const;

const DEFAULT_CORNER_RADIUS = 16;

// ── AppSheet (general-purpose) ───────────────────────────────────────

interface AppSheetProps {
  /** Detents array (fractional 0–1). Default: [0.75] */
  detents?: number[];
  /** Corner radius (default 16) */
  cornerRadius?: number;
  /** Enable scrollable content pinning (default true) */
  scrollable?: boolean;
  /** Fixed header element rendered above scrollable content */
  header?: ReactElement;
}

export default function AppSheet({
  detents = [0.75],
  cornerRadius = DEFAULT_CORNER_RADIUS,
  scrollable = true,
  header,
}: AppSheetProps) {
  return (
    <TrueSheetNavigator
      screenOptions={
        {
          detents,
          detentIndex: detents.length - 1,
          cornerRadius,
          grabber: true,
          grabberOptions: GRABBER_OPTIONS,
          scrollable,
          ...(header ? { header } : {}),
        } as any
      }
    />
  );
}

// ── CommentSheet (comment-specific, max 70%) ─────────────────────────

const COMMENT_MAX_DETENT = 0.7;

interface CommentSheetProps {
  /**
   * Detents for the comment sheet. All numeric values are clamped to <= 0.7
   * unless `allowLargerDetents` is true (comments should NOT set this).
   * Default: [0.7]
   */
  detents?: number[];
  /** Escape hatch — do NOT use in comment sheets */
  allowLargerDetents?: boolean;
  /** Corner radius (default 16) */
  cornerRadius?: number;
  /** Fixed header element rendered above scrollable content */
  header?: ReactElement;
}

export function CommentSheet({
  detents = [COMMENT_MAX_DETENT],
  allowLargerDetents = false,
  cornerRadius = DEFAULT_CORNER_RADIUS,
  header,
}: CommentSheetProps) {
  // Clamp all numeric detents to <= 0.7 unless explicitly overridden
  const clampedDetents = allowLargerDetents
    ? detents
    : detents.map((d) => Math.min(d, COMMENT_MAX_DETENT));

  // initialDetentIndex points at the largest detent (last in sorted array)
  const initialIdx = clampedDetents.length - 1;

  return (
    <TrueSheetNavigator
      screenOptions={
        {
          detents: clampedDetents,
          detentIndex: initialIdx,
          cornerRadius,
          grabber: true,
          grabberOptions: GRABBER_OPTIONS,
          scrollable: true,
          ...(header ? { header } : {}),
        } as any
      }
    />
  );
}
