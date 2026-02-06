/**
 * TicketActionsBar — Sticky bottom actions
 * Wallet (platform-aware), Calendar, Share — respects ticket rules
 * Loading, success, error states for each action.
 */

import React, { memo, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet, CalendarPlus, Share2, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/lib/stores/ui-store";
import { addToWallet } from "@/src/ticket/helpers/add-to-wallet";
import { addTicketToCalendar } from "@/src/ticket/helpers/add-to-calendar";
import { shareTicket } from "@/src/ticket/helpers/share-ticket";
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

type ActionState = "idle" | "loading" | "success" | "error";

export const TicketActionsBar = memo(function TicketActionsBar({
  ticket,
}: TicketActionsBarProps) {
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const tier = ticket.tier || "ga";
  const accent = TIER_ACCENT[tier];

  const isActive = ticket.status === "valid";

  const [walletState, setWalletState] = useState<ActionState>("idle");
  const [calendarState, setCalendarState] = useState<ActionState>("idle");
  const [shareState, setShareState] = useState<ActionState>("idle");

  // ── Wallet ──
  const handleWallet = useCallback(async () => {
    if (walletState === "loading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWalletState("loading");

    const result = await addToWallet(ticket);

    if (result.success) {
      setWalletState("success");
      showToast("success", "Added", "Ticket added to wallet");
      setTimeout(() => setWalletState("idle"), 3000);
    } else {
      setWalletState("error");
      const msg =
        result.error === "not_configured" || result.error === "not_implemented"
          ? "Wallet passes coming soon"
          : "Could not add to wallet";
      showToast("error", "Wallet", msg);
      setTimeout(() => setWalletState("idle"), 3000);
    }
  }, [ticket, walletState, showToast]);

  // ── Calendar ──
  const handleCalendar = useCallback(async () => {
    if (calendarState === "loading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalendarState("loading");

    const result = await addTicketToCalendar(ticket);

    if (result.success) {
      setCalendarState("success");
      showToast(
        "success",
        result.alreadyAdded ? "Already Added" : "Added",
        result.alreadyAdded
          ? "Event is already in your calendar"
          : "Event added to calendar",
      );
      setTimeout(() => setCalendarState("idle"), 3000);
    } else {
      setCalendarState("error");
      const msg =
        result.error === "permission_denied"
          ? "Calendar permission required"
          : "Could not add to calendar";
      showToast("error", "Calendar", msg);
      setTimeout(() => setCalendarState("idle"), 3000);
    }
  }, [ticket, calendarState, showToast]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    if (shareState === "loading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareState("loading");

    const result = await shareTicket(ticket);

    if (result.success) {
      setShareState("idle");
    } else {
      setShareState("error");
      showToast("error", "Share", "Could not share ticket");
      setTimeout(() => setShareState("idle"), 3000);
    }
  }, [ticket, shareState, showToast]);

  if (!isActive) return null;

  const walletLabel = Platform.OS === "ios" ? "Apple Wallet" : "Google Wallet";

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      {/* Wallet */}
      <Pressable
        onPress={handleWallet}
        style={[
          styles.actionButton,
          walletState === "success" && styles.successButton,
        ]}
        disabled={walletState === "loading"}
      >
        {walletState === "loading" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : walletState === "success" ? (
          <Check size={16} color="#22c55e" />
        ) : (
          <Wallet size={16} color="#fff" />
        )}
        <Text
          style={[
            styles.actionLabel,
            walletState === "success" && styles.successLabel,
          ]}
          numberOfLines={1}
        >
          {walletState === "success" ? "Added" : "Wallet"}
        </Text>
      </Pressable>

      {/* Calendar */}
      <Pressable
        onPress={handleCalendar}
        style={[
          styles.actionButton,
          calendarState === "success" && styles.successButton,
        ]}
        disabled={calendarState === "loading"}
      >
        {calendarState === "loading" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : calendarState === "success" ? (
          <Check size={16} color="#22c55e" />
        ) : (
          <CalendarPlus size={16} color="#fff" />
        )}
        <Text
          style={[
            styles.actionLabel,
            calendarState === "success" && styles.successLabel,
          ]}
          numberOfLines={1}
        >
          {calendarState === "success" ? "Added" : "Calendar"}
        </Text>
      </Pressable>

      {/* Share */}
      <Pressable
        onPress={handleShare}
        style={[styles.actionButton, { backgroundColor: `${accent}20` }]}
        disabled={shareState === "loading"}
      >
        {shareState === "loading" ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Share2 size={16} color={accent} />
        )}
        <Text style={[styles.actionLabel, { color: accent }]} numberOfLines={1}>
          Share
        </Text>
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
  successButton: {
    backgroundColor: "rgba(34,197,94,0.1)",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  successLabel: {
    color: "#22c55e",
  },
});
