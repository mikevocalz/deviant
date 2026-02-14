import { View, Text, Platform } from "react-native";
import { useCallback, useEffect } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useAppStore } from "@/lib/stores/app-store";

const TRACK_WIDTH = 84;
const TRACK_HEIGHT = 42;
const THUMB_SIZE = 36;
const TRACK_PADDING = 3;
const THUMB_ON = TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2 - 2;
const THUMB_OFF = 0;

const SPRING_CONFIG = { damping: 20, stiffness: 300 };

export function SpicyToggleFAB() {
  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const setNsfwEnabled = useAppStore((s) => s.setNsfwEnabled);

  // Reanimated shared value — survives OTA reloads correctly
  const thumbX = useSharedValue(nsfwEnabled ? THUMB_ON : THUMB_OFF);

  // Sync shared value when state changes (including after OTA reload)
  useEffect(() => {
    thumbX.value = withSpring(
      nsfwEnabled ? THUMB_ON : THUMB_OFF,
      SPRING_CONFIG,
    );
  }, [nsfwEnabled]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const handleToggle = useCallback(() => {
    const current = useAppStore.getState().nsfwEnabled;
    console.log("[SpicyToggle] Toggling NSFW:", !current);
    setNsfwEnabled(!current);
  }, [setNsfwEnabled]);

  // RNGH Gesture.Tap — wins gesture race against scroll views reliably
  // runOnJS required because onEnd runs on UI thread by default
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleToggle)();
  });

  return (
    <GestureDetector gesture={tapGesture}>
      <View
        style={{
          position: "absolute",
          bottom: 20,
          right: 8,
          zIndex: 50,
          elevation: 50,
          alignItems: "center",
          padding: 8,
        }}
      >
        {/* Track */}
        <View
          style={{
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: nsfwEnabled ? "#991b1b" : "rgb(20, 20, 20)",
            justifyContent: "center",
            paddingHorizontal: TRACK_PADDING,
            borderWidth: 1,
            borderColor: "rgb(38, 38, 38)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Angel emoji (left side, visible when deviant mode ON) */}
          <View
            style={{
              position: "absolute",
              left: 10,
              opacity: nsfwEnabled ? 0.8 : 0,
            }}
          >
            <Text style={{ fontSize: 18 }}>😇</Text>
          </View>

          {/* Devil emoji (right side, visible when angel mode / OFF) */}
          <View
            style={{
              position: "absolute",
              right: 10,
              opacity: nsfwEnabled ? 0 : 0.8,
            }}
          >
            <Text style={{ fontSize: 18 }}>😈</Text>
          </View>

          {/* Animated thumb — reanimated survives OTA reloads */}
          <Animated.View
            style={[
              {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 3,
              },
              thumbStyle,
            ]}
          >
            <Text style={{ fontSize: 18 }}>{nsfwEnabled ? "😈" : "😇"}</Text>
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}
