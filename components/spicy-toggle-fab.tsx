import { Pressable, View, Text } from "react-native";
import { Motion } from "@legendapp/motion";
import { useAppStore } from "@/lib/stores/app-store";

const TRACK_WIDTH = 68;
const TRACK_HEIGHT = 38;
const THUMB_SIZE = 32;
const TRACK_PADDING = 3;

export function SpicyToggleFAB() {
  const { nsfwEnabled, setNsfwEnabled } = useAppStore();

  return (
    <View
      style={{
        position: "absolute",
        bottom: 14,
        right: 6,
        zIndex: 50,
        alignItems: "center",
      }}
    >
      <Pressable onPress={() => setNsfwEnabled(!nsfwEnabled)} hitSlop={12}>
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
          {/* Angel emoji (left side, visible when OFF) */}
          <View
            style={{
              position: "absolute",
              left: 8,
              opacity: nsfwEnabled ? 0.3 : 0,
            }}
          >
            <Text style={{ fontSize: 16 }}>😇</Text>
          </View>

          {/* Devil emoji (right side, visible when ON) */}
          <View
            style={{
              position: "absolute",
              right: 8,
              opacity: nsfwEnabled ? 0 : 0.3,
            }}
          >
            <Text style={{ fontSize: 16 }}>😈</Text>
          </View>

          {/* Animated thumb */}
          <Motion.View
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
      </Pressable>
    </View>
  );
}
