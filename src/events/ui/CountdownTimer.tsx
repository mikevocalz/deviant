import React, { useEffect, useState, memo } from "react";
import { View, Text, StyleSheet } from "react-native";

interface CountdownTimerProps {
  targetDate: string;
}

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds };
}

function formatUnit(value: number, label: string) {
  return `${value}${label}`;
}

export const CountdownTimer = memo(function CountdownTimer({
  targetDate,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      const tl = getTimeLeft(targetDate);
      if (!tl) {
        clearInterval(interval);
        setTimeLeft(null);
        return;
      }
      setTimeLeft(tl);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <View style={styles.chip}>
        <Text style={styles.liveText}>LIVE NOW</Text>
      </View>
    );
  }

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(formatUnit(timeLeft.days, "d"));
  parts.push(formatUnit(timeLeft.hours, "h"));
  parts.push(formatUnit(timeLeft.minutes, "m"));
  if (timeLeft.days === 0) parts.push(formatUnit(timeLeft.seconds, "s"));

  return (
    <View style={styles.chip}>
      <Text style={styles.text}>Starts in {parts.join(" ")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "rgba(63,220,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(63,220,255,0.2)",
  },
  text: {
    color: "#3FDCFF",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  liveText: {
    color: "#FC253A",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
