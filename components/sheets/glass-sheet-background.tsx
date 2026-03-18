/**
 * GlassSheetBackground
 *
 * Drop-in backgroundComponent for @gorhom/bottom-sheet.
 * iOS 26+: native liquid glass via @callstack/liquid-glass
 * iOS <26:  BlurView fallback
 * Android:  solid dark surface
 */
import { Platform } from "react-native";
import { BlurView } from "expo-blur";
import { memo } from "react";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@callstack/liquid-glass";
import Animated from "react-native-reanimated";

const BORDER_RADIUS = 24;

function GlassSheetBackgroundComponent({
  style,
  animatedIndex,
  animatedPosition,
}: BottomSheetBackgroundProps) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect="regular"
        style={[
          style,
          {
            borderTopLeftRadius: BORDER_RADIUS,
            borderTopRightRadius: BORDER_RADIUS,
            overflow: "hidden",
            backgroundColor: "rgba(0,0,0,0.18)",
          },
        ]}
      />
    );
  }

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={40}
        tint="dark"
        style={[
          style,
          {
            borderTopLeftRadius: BORDER_RADIUS,
            borderTopRightRadius: BORDER_RADIUS,
            overflow: "hidden",
          },
        ]}
      />
    );
  }

  // Android fallback
  return (
    <Animated.View
      style={[
        style,
        {
          borderTopLeftRadius: BORDER_RADIUS,
          borderTopRightRadius: BORDER_RADIUS,
          backgroundColor: "#1a1a1a",
        },
      ]}
    />
  );
}

export const GlassSheetBackground = memo(GlassSheetBackgroundComponent);
