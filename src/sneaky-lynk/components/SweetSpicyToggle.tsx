/**
 * Sweet / Spicy Toggle
 *
 * Persisted mode on session. Shown in Sneaky Lynk room header.
 * Does NOT modify the chat screen or cards.
 */

import { View, Text, Pressable } from "react-native";
import { useCallback } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { Flame, Heart } from "lucide-react-native";
import { supabase } from "@/lib/supabase/client";
import { DeccellusAdSlot } from "@/components/ads/DeccellusAdSlot";

interface SweetSpicyToggleProps {
  sessionId: string;
  mode: "sweet" | "spicy";
  onModeChange: (mode: "sweet" | "spicy") => void;
  isHost: boolean;
}

export function SweetSpicyToggle({
  sessionId,
  mode,
  onModeChange,
  isHost,
}: SweetSpicyToggleProps) {
  const progress = useSharedValue(mode === "spicy" ? 1 : 0);

  const handleToggle = useCallback(
    async (newMode: "sweet" | "spicy") => {
      if (!isHost) return; // Only host can toggle
      if (newMode === mode) return;

      progress.value = withSpring(newMode === "spicy" ? 1 : 0, {
        damping: 18,
        stiffness: 200,
      });

      onModeChange(newMode);

      // Persist to DB
      try {
        await supabase
          .from("video_rooms")
          .update({ sweet_spicy_mode: newMode })
          .eq("id", sessionId);
      } catch (err) {
        console.error("[SweetSpicy] Update error:", err);
      }
    },
    [sessionId, mode, isHost, onModeChange],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(progress.value * 120, { damping: 18, stiffness: 200 }) }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(236, 72, 153, 0.15)", "rgba(239, 68, 68, 0.15)"],
    ),
  }));

  return (
    <View className="items-center gap-2">
      <Animated.View
        style={[bgStyle, { borderRadius: 24, position: "relative" }]}
        className="flex-row h-10 w-60 border border-border"
      >
        {/* Sliding indicator */}
        <Animated.View
          style={[
            indicatorStyle,
            {
              position: "absolute",
              top: 2,
              left: 2,
              width: 116,
              height: 32,
              borderRadius: 20,
            },
          ]}
          className={mode === "spicy" ? "bg-red-500/30" : "bg-pink-400/30"}
        />

        {/* Sweet button */}
        <Pressable
          onPress={() => handleToggle("sweet")}
          className="flex-1 flex-row items-center justify-center gap-1.5 z-10"
          disabled={!isHost}
        >
          <Heart
            size={14}
            color={mode === "sweet" ? "#EC4899" : "#9CA3AF"}
            fill={mode === "sweet" ? "#EC4899" : "transparent"}
          />
          <Text
            className={`text-xs font-sans-semibold ${mode === "sweet" ? "text-pink-400" : "text-muted-foreground"}`}
          >
            Sweet
          </Text>
        </Pressable>

        {/* Spicy button */}
        <Pressable
          onPress={() => handleToggle("spicy")}
          className="flex-1 flex-row items-center justify-center gap-1.5 z-10"
          disabled={!isHost}
        >
          <Flame
            size={14}
            color={mode === "spicy" ? "#EF4444" : "#9CA3AF"}
            fill={mode === "spicy" ? "#EF4444" : "transparent"}
          />
          <Text
            className={`text-xs font-sans-semibold ${mode === "spicy" ? "text-red-400" : "text-muted-foreground"}`}
          >
            Spicy
          </Text>
        </Pressable>
      </Animated.View>

      {/* Decellus ad slot for Sweet/Spicy toggle */}
      <DeccellusAdSlot
        placementKey="SWEET_SPICY_TOGGLE"
        style={{ width: 240, marginTop: 4 }}
      />
    </View>
  );
}
