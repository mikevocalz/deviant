import { Pressable, View, Text } from "react-native";
import { Motion } from "@legendapp/motion";
import { useAppStore } from "@/lib/stores/app-store";

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 26;
const TRACK_PADDING = 2;

export function SpicyToggleFAB() {
  const { nsfwEnabled, setNsfwEnabled } = useAppStore();

  return (
    <View
      style={{
        position: "absolute",
        bottom: 24,
        right: 16,
        zIndex: 50,
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={() => setNsfwEnabled(!nsfwEnabled)}
        hitSlop={8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: nsfwEnabled
            ? "rgba(239, 68, 68, 0.95)"
            : "rgba(30, 30, 30, 0.95)",
          borderRadius: 20,
          paddingLeft: 12,
          paddingRight: 6,
          paddingVertical: 4,
          gap: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          borderWidth: 1,
          borderColor: nsfwEnabled
            ? "rgba(239, 68, 68, 0.6)"
            : "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.3,
          }}
        >
          {nsfwEnabled ? "Spicy" : "Sweet"}
        </Text>

        {/* Custom track */}
        <View
          style={{
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: nsfwEnabled ? "#991b1b" : "#333",
            justifyContent: "center",
            paddingHorizontal: TRACK_PADDING,
          }}
        >
          {/* Angel emoji (left side, visible when OFF) */}
          <View
            style={{
              position: "absolute",
              left: 6,
              opacity: nsfwEnabled ? 0.3 : 0,
            }}
          >
            <Text style={{ fontSize: 14 }}>😇</Text>
          </View>

          {/* Devil emoji (right side, visible when ON) */}
          <View
            style={{
              position: "absolute",
              right: 6,
              opacity: nsfwEnabled ? 0 : 0.3,
            }}
          >
            <Text style={{ fontSize: 14 }}>😈</Text>
          </View>

          {/* Animated thumb */}
          <Motion.View
            animate={{
              translateX: nsfwEnabled
                ? TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2
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
            <Text style={{ fontSize: 16 }}>{nsfwEnabled ? "😈" : "😇"}</Text>
          </Motion.View>
        </View>
      </Pressable>
    </View>
  );
}
