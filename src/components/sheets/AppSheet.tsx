/**
 * AppSheet — Standardized TrueSheet navigator wrapper.
 *
 * Uses the official TrueSheet API:
 * - `detents` for height control
 * - `maxHeight` for hard pixel ceiling (applies to base route too)
 * - `grabber` + `grabberOptions` for white drag handle
 * - `cornerRadius` for rounded corners
 * - `scrollable` for proper scroll behavior
 *
 * Variants:
 * - AppSheet (default): general-purpose, detents=[0.75]
 * - CommentSheet: comment-specific, max 70% height, never full-screen
 *
 * CRITICAL: TrueSheet navigator treats the first route as a "base screen"
 * rendered full-screen. `detents` only apply to subsequent sheet routes.
 * `maxHeight` is the ONLY reliable way to cap the base route height.
 */

import type { ReactElement } from "react";
import { Dimensions } from "react-native";
import TrueSheetNavigator from "@/components/navigation/true-sheet-navigator";

const SCREEN_HEIGHT = Dimensions.get("window").height;

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
//
// CRITICAL: TrueSheet navigator treats the first route as a "base screen"
// rendered full-screen. `detents` only apply to subsequent sheet routes.
// Since comments typically have a single route ([postId]), the base route
// would be full-screen without `maxHeight`.
//
// `maxHeight` is a native TrueSheet prop that caps the sheet height in
// pixels for ALL routes, including the base route. This is the ONLY
// reliable way to enforce the 70% ceiling.

const COMMENT_MAX_FRACTION = 0.7;
const COMMENT_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * COMMENT_MAX_FRACTION);

interface CommentSheetProps {
  /**
   * Detents for the comment sheet. All numeric values are clamped to <= 0.7.
   * Default: [0.7]
   */
  detents?: number[];
  /** Corner radius (default 16) */
  cornerRadius?: number;
  /** Fixed header element rendered above scrollable content */
  header?: ReactElement;
}

export function CommentSheet({
  detents = [COMMENT_MAX_FRACTION],
  cornerRadius = DEFAULT_CORNER_RADIUS,
  header,
}: CommentSheetProps) {
  // Clamp all numeric detents to <= 0.7
  const clampedDetents = detents.map((d) => Math.min(d, COMMENT_MAX_FRACTION));

  // initialDetentIndex points at the largest detent (last in sorted array)
  const initialIdx = clampedDetents.length - 1;

  return (
    <TrueSheetNavigator
      screenOptions={
        {
          detents: clampedDetents,
          detentIndex: initialIdx,
          maxHeight: COMMENT_MAX_HEIGHT,
          cornerRadius,
          grabber: true,
          grabberOptions: GRABBER_OPTIONS,
          scrollable: true,
          dimmed: true,
          ...(header ? { header } : {}),
        } as any
      }
    />
  );
}
