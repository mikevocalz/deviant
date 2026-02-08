import React, { memo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ticket, Check, Clock } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import type { TicketTier } from "../types";

interface StickyCTAProps {
  selectedTier: TicketTier | null;
  hasTicket: boolean;
  isPast?: boolean;
  onGetTickets: () => void;
  onViewTicket: () => void;
}

export const StickyCTA = memo(function StickyCTA({
  selectedTier,
  hasTicket,
  isPast,
  onGetTickets,
  onViewTicket,
}: StickyCTAProps) {
  const insets = useSafeAreaInsets();
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!hasTicket && selectedTier && !selectedTier.isSoldOut) {
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
        true,
      );
    } else {
      glowPulse.value = withTiming(0, { duration: 300 });
    }
  }, [hasTicket, selectedTier, glowPulse]);

  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowPulse.value, [0, 1], [0, 0.4]);
    return {
      shadowOpacity: opacity,
    };
  });

  const isSoldOut = selectedTier?.isSoldOut ?? false;
  const price = selectedTier?.price ?? 0;
  const tierName = selectedTier?.name ?? "General";
  const glowColor = selectedTier?.glowColor ?? "rgb(62, 164, 229)";

  if (isPast && !hasTicket) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inner}>
          <View
            style={[styles.ctaButton, { backgroundColor: "#333", flex: 1 }]}
          >
            <Clock size={18} color="rgba(255,255,255,0.5)" />
            <Text style={[styles.ctaText, { color: "rgba(255,255,255,0.5)" }]}>
              Event Ended
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (hasTicket) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inner}>
          <Pressable onPress={onViewTicket} style={styles.ticketButton}>
            <Ticket size={20} color="#fff" />
            <Text style={styles.ticketButtonText}>View Your Ticket</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.inner}>
        {/* Price summary */}
        <View style={styles.priceColumn}>
          <Text style={styles.priceLabel}>{tierName}</Text>
          <Text style={[styles.priceValue, { color: glowColor }]}>
            {price === 0 ? "FREE" : `$${price}`}
          </Text>
        </View>

        {/* CTA Button */}
        <Animated.View
          style={[
            styles.ctaWrapper,
            {
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 20,
            },
            glowStyle,
          ]}
        >
          <Pressable
            onPress={onGetTickets}
            disabled={isSoldOut}
            style={[
              styles.ctaButton,
              { backgroundColor: isSoldOut ? "#333" : glowColor },
            ]}
          >
            {isSoldOut ? (
              <Text style={styles.ctaText}>Sold Out</Text>
            ) : (
              <>
                <Ticket size={18} color="#000" />
                <Text style={[styles.ctaText, { color: "#000" }]}>
                  {price === 0 ? "RSVP Free" : "Get Tickets"}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 14,
  },
  priceColumn: {
    flex: 1,
  },
  priceLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  ctaWrapper: {
    flex: 1.5,
    elevation: 8,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  ticketButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  ticketButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
