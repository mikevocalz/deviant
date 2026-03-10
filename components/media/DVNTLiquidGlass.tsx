/**
 * DVNTLiquidGlass
 *
 * Reusable liquid glass container primitive.
 * Translucent BlurView + subtle white border — readable over any media.
 */
import { View, type ViewStyle, type StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { memo } from "react";

interface DVNTLiquidGlassProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 0-100, default 18 */
  intensity?: number;
  /** "dark" | "light" | "default", default "dark" */
  tint?: "dark" | "light" | "default";
  /** Border radius, default 24 (pill) */
  radius?: number;
  /** Inner padding, default { horizontal: 12, vertical: 8 } */
  paddingH?: number;
  paddingV?: number;
}

function DVNTLiquidGlassComponent({
  children,
  style,
  intensity = 18,
  tint = "dark",
  radius = 24,
  paddingH = 12,
  paddingV = 8,
}: DVNTLiquidGlassProps) {
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          backgroundColor: "rgba(0,0,0,0.28)",
          gap: 12,
        }}
      >
        {children}
      </View>
    </BlurView>
  );
}

export const DVNTLiquidGlass = memo(DVNTLiquidGlassComponent);

/** Single icon button wrapped in liquid glass */
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
  return (
    <BlurView
      intensity={18}
      tint="dark"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
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
          backgroundColor: "rgba(0,0,0,0.28)",
        }}
      >
        {children}
      </View>
    </BlurView>
  );
}

export const DVNTLiquidGlassIconButton = memo(DVNTLiquidGlassIconButtonComponent);
