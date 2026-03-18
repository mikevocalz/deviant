// ============================================================
// AnimatedToolPanel — Reanimated-powered slide-up tool panel
// ============================================================
// Replaces @gorhom/bottom-sheet ToolPanelContainer.
// Key improvements:
//   • Does NOT intercept touches above the panel — canvas/elements
//     remain interactive while panel is open
//   • Pan-to-dismiss gesture on the handle bar
//   • Spring animation for open/close
//   • Same visual language as before (#1a1a1a, rounded corners)
// ============================================================

import React, { useCallback, useEffect } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const SPRING = {
  damping: 22,
  stiffness: 280,
  mass: 0.9,
  overshootClamping: false,
};

interface AnimatedToolPanelProps {
  visible: boolean;
  onDismiss: () => void;
  /** Panel height as percentage of screen (0-1). Default 0.42 */
  heightRatio?: number;
  children: React.ReactNode;
}

export const AnimatedToolPanel: React.FC<AnimatedToolPanelProps> = React.memo(
  ({ visible, onDismiss, heightRatio = 0.42, children }) => {
    const { height: screenH } = useWindowDimensions();
    const panelH = Math.round(screenH * heightRatio);

    // 0 = fully open (panel at bottom), 1 = fully closed (panel off-screen)
    const progress = useSharedValue(1);

    useEffect(() => {
      if (visible) {
        progress.value = withSpring(0, SPRING);
      } else {
        progress.value = withSpring(1, SPRING);
      }
    }, [visible, progress]);

    const onDismissJS = useCallback(() => {
      onDismiss();
    }, [onDismiss]);

    // Pan gesture on the handle — drag down to dismiss
    const panGesture = Gesture.Pan()
      .onUpdate((e) => {
        "worklet";
        // Map drag distance to 0-1 progress (drag down = towards close)
        const p = interpolate(
          e.translationY,
          [0, panelH],
          [0, 1],
          Extrapolation.CLAMP,
        );
        progress.value = p;
      })
      .onEnd((e) => {
        "worklet";
        // Velocity-based snapping
        if (e.velocityY > 500 || progress.value > 0.35) {
          progress.value = withSpring(1, SPRING);
          runOnJS(onDismissJS)();
        } else {
          progress.value = withSpring(0, SPRING);
        }
      });

    const panelStyle = useAnimatedStyle(() => ({
      transform: [
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [0, panelH + 40], // +40 to fully hide below screen
            Extrapolation.CLAMP,
          ),
        },
      ],
    }));

    if (!visible) return null;

    return (
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: panelH,
            zIndex: 80,
            backgroundColor: "#1a1a1a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderCurve: "continuous",
            overflow: "hidden",
          },
          panelStyle,
        ]}
      >
        {/* Handle bar — draggable */}
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              paddingTop: 10,
              paddingBottom: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#555",
              }}
            />
          </View>
        </GestureDetector>

        {/* Panel content */}
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    );
  },
);

AnimatedToolPanel.displayName = "AnimatedToolPanel";
