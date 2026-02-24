/**
 * ImageCropView — Instagram-level pinch/drag/zoom crop component.
 *
 * Renders an image behind a fixed 4:5 crop frame.
 * User pinch-zooms and pans to position the image.
 * Grid lines for rule-of-thirds composition.
 * Focal-point-aware pinch (zoom centers on fingers).
 */

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CROP_ASPECT_RATIO, type CropState } from "./crop-utils";

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const MAX_ZOOM_FACTOR = 5;

interface ImageCropViewProps {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  aspectRatio?: number;
  initialState?: CropState;
  onCropChange?: (state: CropState) => void;
}

export function ImageCropView({
  uri,
  imageWidth,
  imageHeight,
  frameWidth,
  aspectRatio = CROP_ASPECT_RATIO,
  initialState,
  onCropChange,
}: ImageCropViewProps) {
  const frameHeight = Math.round(frameWidth * aspectRatio);

  const minScale = useMemo(
    () => Math.max(frameWidth / imageWidth, frameHeight / imageHeight),
    [imageWidth, imageHeight, frameWidth, frameHeight],
  );
  const maxScale = minScale * MAX_ZOOM_FACTOR;

  // Gesture state (shared values for 60fps animation)
  const scale = useSharedValue(initialState?.scale ?? minScale);
  const translateX = useSharedValue(initialState?.translateX ?? 0);
  const translateY = useSharedValue(initialState?.translateY ?? 0);

  // Saved state at gesture start
  const savedScale = useSharedValue(initialState?.scale ?? minScale);
  const savedTranslateX = useSharedValue(initialState?.translateX ?? 0);
  const savedTranslateY = useSharedValue(initialState?.translateY ?? 0);

  const notifyCropChange = (s: number, tx: number, ty: number) => {
    onCropChange?.({ scale: s, translateX: tx, translateY: ty });
  };

  // Clamp to valid bounds with spring animation
  // CRITICAL: All math is inlined — worklets CANNOT call imported JS functions
  const clampAndNotify = () => {
    "worklet";
    const cs = Math.max(minScale, Math.min(maxScale, scale.value));
    // Inline clampPan: ensure image always covers the frame
    const dw = imageWidth * cs;
    const dh = imageHeight * cs;
    const maxPanX = Math.max(0, (dw - frameWidth) / 2);
    const maxPanY = Math.max(0, (dh - frameHeight) / 2);
    const clampedX = Math.min(maxPanX, Math.max(-maxPanX, translateX.value));
    const clampedY = Math.min(maxPanY, Math.max(-maxPanY, translateY.value));

    scale.value = withSpring(cs, SPRING_CONFIG);
    translateX.value = withSpring(clampedX, SPRING_CONFIG);
    translateY.value = withSpring(clampedY, SPRING_CONFIG);
    runOnJS(notifyCropChange)(cs, clampedX, clampedY);
  };

  // Pan gesture — delta-based for simultaneous compat
  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      clampAndNotify();
    });

  // Pinch gesture — focal-point-aware zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Allow rubber-band below minScale (snaps back on end)
      const newScale = Math.min(
        maxScale,
        Math.max(minScale * 0.5, savedScale.value * e.scale),
      );
      scale.value = newScale;

      // Focal-point-aware: keep point under fingers stationary
      const fx = e.focalX - frameWidth / 2;
      const fy = e.focalY - frameHeight / 2;
      const ds = newScale / savedScale.value;
      translateX.value = fx + ds * (savedTranslateX.value - fx);
      translateY.value = fy + ds * (savedTranslateY.value - fy);
    })
    .onEnd(() => {
      clampAndNotify();
    });

  // Double-tap to reset
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(minScale, SPRING_CONFIG);
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      runOnJS(notifyCropChange)(minScale, 0, 0);
    });

  const composed = Gesture.Exclusive(
    doubleTap,
    Gesture.Simultaneous(panGesture, pinchGesture),
  );

  // Animated image style — centered in frame with pan/zoom offset
  const animatedImageStyle = useAnimatedStyle(() => {
    const dw = imageWidth * scale.value;
    const dh = imageHeight * scale.value;
    return {
      width: dw,
      height: dh,
      transform: [
        { translateX: (frameWidth - dw) / 2 + translateX.value },
        { translateY: (frameHeight - dh) / 2 + translateY.value },
      ],
    };
  });

  return (
    <View
      style={[styles.container, { width: frameWidth, height: frameHeight }]}
    >
      <GestureDetector gesture={composed}>
        <View
          style={[styles.frame, { width: frameWidth, height: frameHeight }]}
        >
          <Animated.View style={[styles.imageWrap, animatedImageStyle]}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
            />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Rule-of-thirds grid */}
      <View
        style={[styles.gridOverlay, { width: frameWidth, height: frameHeight }]}
        pointerEvents="none"
      >
        <View style={[styles.gridH, { top: frameHeight / 3 }]} />
        <View style={[styles.gridH, { top: (frameHeight / 3) * 2 }]} />
        <View style={[styles.gridV, { left: frameWidth / 3 }]} />
        <View style={[styles.gridV, { left: (frameWidth / 3) * 2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  frame: {
    overflow: "hidden",
  },
  imageWrap: {
    position: "absolute",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
});
