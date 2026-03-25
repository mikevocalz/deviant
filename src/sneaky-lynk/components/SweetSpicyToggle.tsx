/**
 * Sweet / Spicy Toggle
 *
 * Controlled room-mode toggle for Sneaky Lynk.
 */

import { View, Text } from "react-native";
import { useCallback, useEffect, useMemo } from "react";
import Animated, {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { Flame, Heart } from "lucide-react-native";
import { DeccellusAdSlot } from "@/components/ads/DeccellusAdSlot";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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
  const translateDistance = width / 2;
  const activeIndex = useSharedValue(mode === "spicy" ? 1 : 0);
  const pressScale = useSharedValue(1);

  const animateTo = useCallback(
    (nextMode: "sweet" | "spicy") => {
      const nextIndex = nextMode === "spicy" ? 1 : 0;
      cancelAnimation(progress);
      cancelAnimation(activeIndex);
      progress.value = withSpring(nextIndex, {
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      });
      activeIndex.value = nextIndex;
    },
    [activeIndex, progress],
  );

  useEffect(() => {
    animateTo(mode);
  }, [animateTo, mode]);

  const handleToggle = useCallback(
    (newMode: "sweet" | "spicy") => {
      if (disabled || newMode === mode) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateTo(newMode);
      onModeChange(newMode);
    },
    [animateTo, disabled, mode, onModeChange],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onBegin(() => {
          pressScale.value = withSpring(0.985, {
            damping: 18,
            stiffness: 280,
          });
        })
        .onFinalize(() => {
          pressScale.value = withSpring(1, {
            damping: 18,
            stiffness: 280,
          });
        })
        .onEnd((event, success) => {
          if (!success) return;
          const nextMode = event.x >= width / 2 ? "spicy" : "sweet";
          if (
            disabled ||
            nextMode === (activeIndex.value ? "spicy" : "sweet")
          ) {
            return;
          }
          activeIndex.value = nextMode === "spicy" ? 1 : 0;
          progress.value = withSpring(activeIndex.value, {
            damping: 18,
            stiffness: 220,
            mass: 0.8,
          });
          runOnJS(handleToggle)(nextMode);
        }),
    [activeIndex, disabled, handleToggle, pressScale, progress, width],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pressScale.value },
      { translateX: progress.value * translateDistance },
    ],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1,
      },
    ],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(236, 72, 153, 0.15)", "rgba(239, 68, 68, 0.15)"],
    ),
  }));

  return (
    <View style={{ alignItems: "flex-start", gap: showAdSlot ? 8 : 0 }}>
      <GestureDetector gesture={tapGesture}>
        <Animated.View
          style={[
            bgStyle,
            containerStyle,
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
                backgroundColor:
                  mode === "spicy"
                    ? "rgba(239, 68, 68, 0.3)"
                    : "rgba(244, 114, 182, 0.3)",
              },
            ]}
          />

          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "stretch",
              zIndex: 10,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 4 : 6,
              }}
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
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 4 : 6,
              }}
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
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {showAdSlot ? (
        <DeccellusAdSlot
          placementKey="SWEET_SPICY_TOGGLE"
          style={{ width: width + 4, marginTop: 4 }}
        />
      ) : null}
    </View>
  );
}
