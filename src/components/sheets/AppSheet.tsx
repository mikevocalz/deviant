/**
 * AppSheet — Standardized TrueSheet wrapper.
 *
 * Enforces:
 * - Default max snap point = 75% screen height
 * - Handle indicator color = white
 * - Corner radius = 16
 * - Grabber visible
 *
 * All TrueSheet-based layouts should use this wrapper
 * instead of configuring TrueSheetNavigator directly.
 */

import { Dimensions } from "react-native";
import TrueSheetNavigator from "@/components/navigation/true-sheet-navigator";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_SNAP_RATIO = 0.75;

interface AppSheetProps {
  /** Override max snap ratio (clamped to 0.75 unless allowOverflow is true) */
  maxSnapRatio?: number;
  /** Allow snap ratio > 0.75 (use sparingly) */
  allowOverflow?: boolean;
  /** Corner radius (default 16) */
  cornerRadius?: number;
}

export default function AppSheet({
  maxSnapRatio = MAX_SNAP_RATIO,
  allowOverflow = false,
  cornerRadius = 16,
}: AppSheetProps) {
  const clampedRatio = allowOverflow
    ? maxSnapRatio
    : Math.min(maxSnapRatio, MAX_SNAP_RATIO);

  return (
    <TrueSheetNavigator
      screenOptions={
        {
          maxHeight: Math.round(SCREEN_HEIGHT * clampedRatio),
          cornerRadius,
          grabber: true,
          grabberProps: {
            color: "#FFFFFF",
          },
          handleIndicatorStyle: {
            backgroundColor: "#FFFFFF",
          },
        } as any
      }
    />
  );
}
