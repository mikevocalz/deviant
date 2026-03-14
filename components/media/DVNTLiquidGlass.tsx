/**
 * DVNTLiquidGlass
 *
 * Reusable liquid glass container primitive.
 *
 * iOS 26+: native UIKit glass via @callstack/liquid-glass (LiquidGlassView).
 * iOS <26: BlurView fallback — same visual contract, no crash.
 */
import { View, type ViewStyle, type StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { memo } from "react";
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@callstack/liquid-glass";

interface DVNTLiquidGlassProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Border radius, default 24 (pill) */
  radius?: number;
  /** Inner padding horizontal, default 12 */
  paddingH?: number;
  /** Inner padding vertical, default 8 */
  paddingV?: number;
}

function DVNTLiquidGlassComponent({
  children,
  style,
  radius = 24,
  paddingH = 12,
  paddingV = 8,
}: DVNTLiquidGlassProps) {
  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: paddingH,
        paddingVertical: paddingV,
        gap: 12,
      }}
    >
      {children}
    </View>
  );

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect="regular"
        interactive
        style={[{ borderRadius: radius, overflow: "hidden" }, style]}
      >
        <View style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>{inner}</View>
      </LiquidGlassView>
    );
  }

  return (
    <BlurView
      intensity={18}
      tint="dark"
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.22)",
        },
        style,
      ]}
    >
      <View style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>{inner}</View>
    </BlurView>
  );
}

export const DVNTLiquidGlass = memo(DVNTLiquidGlassComponent);

// ─── Icon button variant ─────────────────────────────────────────────────────

interface DVNTLiquidGlassIconButtonProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: number;
}

function DVNTLiquidGlassIconButtonComponent({
  children,
  style,
  size = 36,
}: DVNTLiquidGlassIconButtonProps) {
  const radius = size / 4;

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect="regular"
        interactive
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.25)",
          }}
        >
          {children}
        </View>
      </LiquidGlassView>
    );
  }

  return (
    <BlurView
      intensity={18}
      tint="dark"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.22)",
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        {children}
      </View>
    </BlurView>
  );
}

export const DVNTLiquidGlassIconButton = memo(
  DVNTLiquidGlassIconButtonComponent,
);
