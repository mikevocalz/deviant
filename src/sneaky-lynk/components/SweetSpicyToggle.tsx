/**
 * Sweet / Spicy Toggle
 *
 * Controlled room-mode toggle for Sneaky Lynk.
 */

import { View, Text, Pressable } from "react-native";
import { useCallback, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { Flame, Heart } from "lucide-react-native";
import { DeccellusAdSlot } from "@/components/ads/DeccellusAdSlot";
import * as Haptics from "expo-haptics";

interface SweetSpicyToggleProps {
  mode: "sweet" | "spicy";
  onModeChange: (mode: "sweet" | "spicy") => void;
  disabled?: boolean;
  compact?: boolean;
  showAdSlot?: boolean;
}

export function SweetSpicyToggle({
  mode,
  onModeChange,
  disabled = false,
  compact = false,
  showAdSlot = false,
}: SweetSpicyToggleProps) {
  const progress = useSharedValue(mode === "spicy" ? 1 : 0);
  const width = compact ? 154 : 240;
  const height = compact ? 34 : 40;
  const indicatorWidth = width / 2 - 4;

  useEffect(() => {
    progress.value = withSpring(mode === "spicy" ? 1 : 0, {
      damping: 18,
      stiffness: 220,
    });
  }, [mode, progress]);

  const handleToggle = useCallback(
    (newMode: "sweet" | "spicy") => {
      if (disabled || newMode === mode) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      progress.value = withSpring(newMode === "spicy" ? 1 : 0, {
        damping: 18,
        stiffness: 220,
      });
      onModeChange(newMode);
    },
    [disabled, mode, onModeChange, progress],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(progress.value * (width / 2), {
          damping: 18,
          stiffness: 220,
        }),
      },
    ],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(236, 72, 153, 0.15)", "rgba(239, 68, 68, 0.15)"],
    ),
  }));

  return (
    <View style={{ alignItems: "flex-start", gap: showAdSlot ? 8 : 0 }}>
      <Animated.View
        style={[
          bgStyle,
          {
            width,
            height,
            borderRadius: compact ? 12 : 18,
            position: "relative",
            borderWidth: 1,
            borderColor: disabled
              ? "rgba(255,255,255,0.1)"
              : "rgba(255,255,255,0.16)",
            opacity: disabled ? 0.64 : 1,
          },
        ]}
      >
        {/* Sliding indicator */}
        <Animated.View
          style={[
            indicatorStyle,
            {
              position: "absolute",
              top: 2,
              left: 2,
              width: indicatorWidth,
              height: height - 4,
              borderRadius: compact ? 10 : 16,
            },
          ]}
          className={mode === "spicy" ? "bg-red-500/30" : "bg-pink-400/30"}
        />

        {/* Sweet button */}
        <Pressable
          onPress={() => handleToggle("sweet")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? 4 : 6,
            zIndex: 10,
          }}
          disabled={disabled}
        >
          <Heart
            size={compact ? 12 : 14}
            color={mode === "sweet" ? "#EC4899" : "#9CA3AF"}
            fill={mode === "sweet" ? "#EC4899" : "transparent"}
          />
          <Text
            style={{
              color: mode === "sweet" ? "#F472B6" : "#94A3B8",
              fontSize: compact ? 11 : 12,
              fontWeight: "700",
            }}
          >
            Sweet
          </Text>
        </Pressable>

        {/* Spicy button */}
        <Pressable
          onPress={() => handleToggle("spicy")}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? 4 : 6,
            zIndex: 10,
          }}
          disabled={disabled}
        >
          <Flame
            size={compact ? 12 : 14}
            color={mode === "spicy" ? "#EF4444" : "#9CA3AF"}
            fill={mode === "spicy" ? "#EF4444" : "transparent"}
          />
          <Text
            style={{
              color: mode === "spicy" ? "#F87171" : "#94A3B8",
              fontSize: compact ? 11 : 12,
              fontWeight: "700",
            }}
          >
            Spicy
          </Text>
        </Pressable>
      </Animated.View>

      {showAdSlot ? (
        <DeccellusAdSlot
          placementKey="SWEET_SPICY_TOGGLE"
          style={{ width: width + 4, marginTop: 4 }}
        />
      ) : null}
    </View>
  );
}
