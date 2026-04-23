/**
 * OfflineBanner
 *
 * Premium offline status surface — sits above the content, not over it.
 * Slides down from under the status bar when the connectivity store says
 * we're offline. Dismisses itself the moment we reconnect.
 *
 * Design goals:
 *   - non-intrusive (60px tall, translucent surface, tasteful icon)
 *   - no spam: banner is driven by a flap-debounced store phase, so
 *     brief signal dips never surface it
 *   - no re-render storm: single selector on `phase` — nothing else in
 *     the app re-renders when this banner shows/hides
 *   - scroll-position safe: banner is absolutely positioned; feed
 *     scroll is untouched
 *   - Instagram/Threads style: subtle pill "You're offline" with a
 *     persistent status until reconnected; on reconnect a brief
 *     "Back online" confirmation fades in then out
 */

import { useEffect, useRef } from "react";
import { Text, View, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { WifiOff, Wifi } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectivityStore } from "@/lib/stores/connectivity-store";

type Surface = "offline" | "reconnected" | "hidden";

// How long the "Back online" confirmation stays on screen before fading.
const RECONNECT_FLASH_MS = 1800;

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const phase = useConnectivityStore((s) => s.phase);

  // Drive surface state from the store phase + a short "reconnected"
  // flash. Using a ref + sharedValue instead of component state so we
  // honor the project state policy (no useState). Reanimated's
  // useSharedValue is UI-thread state, not React state.
  const surfaceRef = useRef<Surface>("hidden");
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const colorAnim = useSharedValue(0);

  useEffect(() => {
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    const show = (next: Surface) => {
      surfaceRef.current = next;
      colorAnim.value = withTiming(next === "reconnected" ? 1 : 0, {
        duration: 240,
      });
      translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
      opacity.value = withTiming(1, { duration: 180 });
    };

    const hide = (onFinish?: () => void) => {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(
        -100,
        { duration: 220, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished && onFinish) runOnJS(onFinish)();
        },
      );
    };

    if (phase === "offline") {
      show("offline");
    } else if (phase === "online") {
      // Only fire the "Back online" flash if we were previously showing
      // the offline state. Avoids an unnecessary flash on cold start
      // when phase goes from the initial "online" placeholder to
      // "online" proper.
      if (surfaceRef.current === "offline") {
        show("reconnected");
        flashTimer = setTimeout(() => {
          hide(() => {
            surfaceRef.current = "hidden";
          });
        }, RECONNECT_FLASH_MS);
      } else if (surfaceRef.current !== "hidden") {
        hide(() => {
          surfaceRef.current = "hidden";
        });
      }
    }
    // "reconnecting" is deliberately ignored — the flap-debounce in the
    // store handles that, we never surface a half-state to users.

    return () => {
      if (flashTimer != null) clearTimeout(flashTimer);
    };
  }, [phase, colorAnim, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const bgStyle = useAnimatedStyle(() => {
    const bg = interpolate(colorAnim.value, [0, 1], [0, 1]);
    return {
      backgroundColor:
        bg < 0.5
          ? "rgba(40, 40, 44, 0.96)"
          : "rgba(20, 122, 72, 0.96)", // green confirmation
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { paddingTop: insets.top + 4 },
        animatedStyle,
      ]}
    >
      <Animated.View style={[styles.pill, bgStyle]}>
        {phase === "online" ? (
          <Wifi size={14} color="#fff" />
        ) : (
          <WifiOff size={14} color="#fff" />
        )}
        <Text style={styles.label}>
          {phase === "online" ? "Back online" : "You’re offline"}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5000,
    // iOS: elevation is ignored. Android: need it so the banner stacks
    // above Stack navigator shadows.
    elevation: Platform.OS === "android" ? 20 : 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    // Subtle light border matches DVNT's liquid-glass language
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    // Soft shadow — visible enough to lift the pill off the content
    // without screaming for attention.
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  label: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
