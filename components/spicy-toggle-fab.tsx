import { View, Text, Platform } from "react-native";
import { useCallback } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Motion } from "@legendapp/motion";
import { useAppStore } from "@/lib/stores/app-store";

const TRACK_WIDTH = 84;
const TRACK_HEIGHT = 42;
const THUMB_SIZE = 36;
const TRACK_PADDING = 3;

export function SpicyToggleFAB() {
  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const setNsfwEnabled = useAppStore((s) => s.setNsfwEnabled);

  const handleToggle = useCallback(() => {
    // Read directly from store to avoid stale closures
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

          {/* Animated thumb — key forces re-mount after OTA to avoid stale animation */}
          <Motion.View
            key={`thumb-${nsfwEnabled ? "on" : "off"}`}
            initial={{
              translateX: nsfwEnabled
                ? TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2 - 2
                : 0,
            }}
            animate={{
              translateX: nsfwEnabled
                ? TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2 - 2
                : 0,
            }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 300,
            }}
            style={{
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
            }}
          >
            <Text style={{ fontSize: 18 }}>{nsfwEnabled ? "😈" : "😇"}</Text>
          </Motion.View>
        </View>
      </View>
    </GestureDetector>
  );
}
