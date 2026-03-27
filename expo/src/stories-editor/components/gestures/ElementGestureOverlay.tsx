// ============================================================
// Per-Element Gesture Overlay (wcandillon pattern)
// ============================================================
// Renders an invisible Animated.View on top of the Skia Canvas,
// positioned to match the element's screen-space bounding box.
// Pan/pinch/rotate gestures write directly to Reanimated shared
// values on the UI thread — no runOnJS during gestures.
// On gesture end, the final transform is committed to Zustand.
// ============================================================

import React, { useCallback } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import type { RenderSurface } from "../../utils/geometry";
import { liveTransformRegistry } from "./shared-element-transforms";

interface ElementGestureOverlayProps {
  elementId: string;
  elementType: string;
  elementWidth: number;
  elementHeight: number;
  surface: RenderSurface;
  isSelected: boolean;
  initialTransform: {
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
  };
  onSelect: (id: string | null) => void;
  onTransformEnd: (
    id: string,
    transform: {
      translateX: number;
      translateY: number;
      scale: number;
      rotation: number;
    },
  ) => void;
  onDoubleTap?: (id: string) => void;
}

export const ElementGestureOverlay: React.FC<ElementGestureOverlayProps> =
  React.memo(
    ({
      elementId,
      elementType,
      elementWidth,
      elementHeight,
      surface,
      isSelected,
      initialTransform,
      onSelect,
      onTransformEnd,
      onDoubleTap,
    }) => {
      // Get the shared values from the registry (created by useElementTransform in Skia renderer)
      const live = liveTransformRegistry.get(elementId);
      // Fallback shared values seeded from the element's Zustand transform
      // so the overlay starts at the correct position even before the Skia
      // renderer mounts and populates the registry.
      const fallbackX = useSharedValue(initialTransform.translateX);
      const fallbackY = useSharedValue(initialTransform.translateY);
      const fallbackScale = useSharedValue(initialTransform.scale);
      const fallbackRotation = useSharedValue(initialTransform.rotation);

      const tx = live?.translateX ?? fallbackX;
      const ty = live?.translateY ?? fallbackY;
      const sc = live?.scale ?? fallbackScale;
      const rot = live?.rotation ?? fallbackRotation;

      // Gesture anchors (set at gesture start, accumulated during gesture)
      const panAnchorX = useSharedValue(0);
      const panAnchorY = useSharedValue(0);
      const pinchAnchorScale = useSharedValue(1);
      const rotationAnchorDeg = useSharedValue(0);
      const selectIfNeeded = useCallback(() => {
        if (!isSelected) onSelect(elementId);
      }, [isSelected, elementId, onSelect]);

      const commitTransform = useCallback(
        (id: string) => {
          // Re-read from the live registry (most up-to-date)
          const current = liveTransformRegistry.get(id);
          if (!current) return;
          onTransformEnd(id, {
            translateX: current.translateX.value,
            translateY: current.translateY.value,
            scale: current.scale.value,
            rotation: current.rotation.value,
          });
        },
        [onTransformEnd],
      );

      // ---- Pan ----
      const pan = Gesture.Pan()
        .onStart(() => {
          "worklet";
          panAnchorX.value = tx.value;
          panAnchorY.value = ty.value;
          runOnJS(selectIfNeeded)();
        })
        .onChange((e) => {
          "worklet";
          // Convert screen-space delta → canvas-space delta
          tx.value = panAnchorX.value + e.translationX / surface.scale;
          ty.value = panAnchorY.value + e.translationY / surface.scale;
        })
        .onEnd(() => {
          "worklet";
          runOnJS(commitTransform)(elementId);
        });

      // ---- Pinch ----
      const pinch = Gesture.Pinch()
        .onStart(() => {
          "worklet";
          pinchAnchorScale.value = sc.value;
        })
        .onChange((e) => {
          "worklet";
          sc.value = Math.max(
            0.2,
            Math.min(5, pinchAnchorScale.value * e.scale),
          );
        })
        .onEnd(() => {
          "worklet";
          runOnJS(commitTransform)(elementId);
        });

      // ---- Rotation ----
      const rotate = Gesture.Rotation()
        .onStart(() => {
          "worklet";
          rotationAnchorDeg.value = rot.value;
        })
        .onChange((e) => {
          "worklet";
          rot.value = rotationAnchorDeg.value + (e.rotation * 180) / Math.PI;
        })
        .onEnd(() => {
          "worklet";
          runOnJS(commitTransform)(elementId);
        });

      // ---- Double tap to edit text ----
      const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          "worklet";
          if (onDoubleTap) {
            runOnJS(onDoubleTap)(elementId);
          }
        });

      const gesture = Gesture.Race(
        doubleTap,
        Gesture.Simultaneous(pan, pinch, rotate),
      );

      // Position the invisible overlay at the element's screen location
      // Use a minimum screen-space size so two-finger pinch is always possible
      const MIN_OVERLAY_PX = 120;
      const animatedStyle = useAnimatedStyle(() => {
        const scaledW = Math.max(
          elementWidth * sc.value * surface.scale,
          MIN_OVERLAY_PX,
        );
        const scaledH = Math.max(
          elementHeight * sc.value * surface.scale,
          MIN_OVERLAY_PX,
        );

        const centerScreenX = tx.value * surface.scale + surface.offsetX;
        const centerScreenY = ty.value * surface.scale + surface.offsetY;

        return {
          position: "absolute" as const,
          left: centerScreenX - scaledW / 2,
          top: centerScreenY - scaledH / 2,
          width: scaledW,
          height: scaledH,
          transform: [{ rotate: `${rot.value}deg` }],
        };
      });

      return (
        <GestureDetector gesture={gesture}>
          <Animated.View style={animatedStyle} collapsable={false} />
        </GestureDetector>
      );
    },
  );

ElementGestureOverlay.displayName = "ElementGestureOverlay";
