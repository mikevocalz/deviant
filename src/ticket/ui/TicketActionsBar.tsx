/**
 * TicketActionsBar — Sticky bottom actions
 * Transfer, Apple Wallet, Share — respects ticket rules
 */

import React, { memo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Share, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRightLeft,
  Wallet,
  Share2,
  Ban,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { Ticket, TicketTierLevel } from "@/lib/stores/ticket-store";

interface TicketActionsBarProps {
  ticket: Ticket;
}

const TIER_ACCENT: Record<TicketTierLevel, string> = {
  free: "#a3a3a3",
  ga: "#60a5fa",
  vip: "#fbbf24",
  table: "#c084fc",
};

export const TicketActionsBar = memo(function TicketActionsBar({
  ticket,
}: TicketActionsBarProps) {
  const insets = useSafeAreaInsets();
  const tier = ticket.tier || "ga";
  const accent = TIER_ACCENT[tier];

  const isActive = ticket.status === "valid";
  const canTransfer = isActive && ticket.transferable !== false;
  const hasAppleWallet = Boolean(ticket.applePassUrl);

  const handleTransfer = useCallback(() => {
    if (!canTransfer) {
      Alert.alert("Not Available", "This ticket cannot be transferred.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Transfer Ticket",
      "Send this ticket to someone else? You will lose access once transferred.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Transfer", style: "destructive" },
      ],
    );
  }, [canTransfer]);

  const handleWallet = useCallback(() => {
    if (!hasAppleWallet) {
      Alert.alert("Coming Soon", "Apple Wallet passes will be available soon.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [hasAppleWallet]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `I'm going to ${ticket.eventTitle || "an event"}! 🎉`,
      });
    } catch {
      // User cancelled
    }
  }, [ticket.eventTitle]);

  if (!isActive) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom + 8 },
      ]}
    >
      {/* Transfer */}
      <Pressable
        onPress={handleTransfer}
        style={[
          styles.actionButton,
          !canTransfer && styles.disabledButton,
        ]}
      >
        {canTransfer ? (
          <ArrowRightLeft size={18} color="#fff" />
        ) : (
          <Ban size={18} color="rgba(255,255,255,0.25)" />
        )}
        <Text
          style={[
            styles.actionLabel,
            !canTransfer && styles.disabledLabel,
          ]}
        >
          Transfer
        </Text>
      </Pressable>

      {/* Apple Wallet */}
      <Pressable
        onPress={handleWallet}
        style={[
          styles.actionButton,
          styles.walletButton,
        ]}
      >
        <Wallet size={18} color="#fff" />
        <Text style={styles.actionLabel}>Wallet</Text>
      </Pressable>

      {/* Share */}
      <Pressable
        onPress={handleShare}
        style={[styles.actionButton, { backgroundColor: `${accent}20` }]}
      >
        <Share2 size={18} color={accent} />
        <Text style={[styles.actionLabel, { color: accent }]}>Share</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(10,10,10,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  walletButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  disabledButton: {
    opacity: 0.4,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledLabel: {
    color: "rgba(255,255,255,0.25)",
  },
});
