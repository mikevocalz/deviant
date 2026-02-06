import React, { memo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { TicketTier } from "../types";

interface TicketTierCardProps {
  tier: TicketTier;
  isSelected: boolean;
  onSelect: (tier: TicketTier) => void;
}

export const TicketTierCard = memo(function TicketTierCard({
  tier,
  isSelected,
  onSelect,
}: TicketTierCardProps) {
  const handlePress = useCallback(() => {
    if (tier.isSoldOut) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(tier);
  }, [tier, onSelect]);

  const isVip = tier.tier === "vip" || tier.tier === "table";
  const borderColor = isSelected
    ? tier.glowColor
    : "rgba(255,255,255,0.08)";
  const bgColor = isSelected
    ? `${tier.glowColor}15`
    : "rgba(255,255,255,0.04)";

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        {
          borderColor,
          backgroundColor: bgColor,
          opacity: tier.isSoldOut ? 0.5 : 1,
        },
      ]}
    >
      {/* Selected indicator */}
      {isSelected && (
        <View style={[styles.selectedBadge, { backgroundColor: tier.glowColor }]}>
          <Check size={12} color="#000" strokeWidth={3} />
        </View>
      )}

      {/* Tier label */}
      <View style={[styles.tierBadge, { backgroundColor: `${tier.glowColor}25` }]}>
        <Text style={[styles.tierBadgeText, { color: tier.glowColor }]}>
          {tier.tier.toUpperCase()}
        </Text>
      </View>

      {/* Name */}
      <Text style={styles.name}>{tier.name}</Text>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, isVip && { color: tier.glowColor }]}>
          {tier.price === 0 ? "FREE" : `$${tier.price}`}
        </Text>
        {tier.originalPrice != null && tier.originalPrice > tier.price && (
          <Text style={styles.originalPrice}>${tier.originalPrice}</Text>
        )}
      </View>

      {/* Perks */}
      {tier.perks.length > 0 && (
        <View style={styles.perks}>
          {tier.perks.slice(0, 3).map((perk, i) => (
            <View key={i} style={styles.perkRow}>
              <Text style={styles.perkCheck}>✓</Text>
              <Text style={styles.perkText} numberOfLines={1}>
                {perk}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Remaining */}
      <View style={styles.footer}>
        {tier.isSoldOut ? (
          <Text style={styles.soldOut}>SOLD OUT</Text>
        ) : tier.remaining <= 10 ? (
          <Text style={styles.urgency}>Only {tier.remaining} left</Text>
        ) : (
          <Text style={styles.remaining}>{tier.remaining} available</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 200,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginRight: 12,
    position: "relative",
  },
  selectedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tierBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  name: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 12,
  },
  price: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },
  originalPrice: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  perks: {
    gap: 5,
    marginBottom: 12,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perkCheck: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
  },
  perkText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    flex: 1,
  },
  footer: {
    marginTop: "auto",
  },
  soldOut: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  urgency: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "600",
  },
  remaining: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
  },
});
