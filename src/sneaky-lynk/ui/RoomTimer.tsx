/**
 * Room Timer Component
 * 16-minute max room duration. Shows countdown in the last 60 seconds.
 * Auto-triggers onTimeUp when timer hits 0.
 */

import { View, Text, Animated, Easing } from "react-native";
import { useEffect, useRef, useState, useCallback } from "react";
import { Clock } from "lucide-react-native";

const ROOM_DURATION_MS = 16 * 60 * 1000; // 16 minutes
const COUNTDOWN_THRESHOLD_MS = 60 * 1000; // Show countdown in last 60s

interface RoomTimerProps {
  /** Called when the timer reaches 0 */
  onTimeUp: () => void;
  /** Timestamp when the room started (defaults to mount time) */
  startedAt?: number;
}

export function RoomTimer({ onTimeUp, startedAt }: RoomTimerProps) {
  const mountTime = useRef(startedAt ?? Date.now()).current;
  const [remainingMs, setRemainingMs] = useState(ROOM_DURATION_MS);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const hasEnded = useRef(false);

  // Pulse animation for the countdown badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - mountTime;
      const remaining = Math.max(0, ROOM_DURATION_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0 && !hasEnded.current) {
        hasEnded.current = true;
        clearInterval(interval);
        onTimeUpRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mountTime]);

  // Start pulse when countdown is visible
  const showCountdown = remainingMs <= COUNTDOWN_THRESHOLD_MS && remainingMs > 0;

  useEffect(() => {
    if (!showCountdown) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [showCountdown, pulseAnim]);

  if (!showCountdown) return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 100,
        right: 16,
        transform: [{ scale: pulseAnim }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: "rgba(252, 37, 58, 0.9)",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
        }}
      >
        <Clock size={14} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
          Ending in: {display}
        </Text>
      </View>
    </Animated.View>
  );
}
