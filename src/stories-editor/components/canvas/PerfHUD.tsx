// ============================================================
// PerfHUD — Lightweight performance overlay for the Story Editor
// ============================================================
// Shows JS/UI thread FPS, element count, and drawing point count.
// Toggle via a dev-only button or long-press gesture.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

interface PerfHUDProps {
  visible: boolean;
  elementCount: number;
  drawingPathCount: number;
  drawingPointCount: number;
}

export const PerfHUD: React.FC<PerfHUDProps> = React.memo(
  ({ visible, elementCount, drawingPathCount, drawingPointCount }) => {
    const [jsFps, setJsFps] = useState(0);
    const frameCount = useRef(0);
    const lastTime = useRef(Date.now());

    useEffect(() => {
      if (!visible) return;

      let rafId: number;
      const tick = () => {
        frameCount.current++;
        const now = Date.now();
        if (now - lastTime.current >= 1000) {
          setJsFps(frameCount.current);
          frameCount.current = 0;
          lastTime.current = now;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, [visible]);

    if (!visible) return null;

    return (
      <View style={styles.container} pointerEvents="none">
        <Text style={styles.text}>JS {jsFps} fps</Text>
        <Text style={styles.text}>
          {elementCount} layers · {drawingPathCount} paths · {drawingPointCount}{" "}
          pts
        </Text>
      </View>
    );
  },
);

PerfHUD.displayName = "PerfHUD";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  text: {
    color: "#0f0",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "600",
  },
});
