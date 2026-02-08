/**
 * View Ticket — Luxury Digital Pass
 * posh.vip-style VIP ticket with glassmorphism, tier accents, and animated QR
 */

import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { ArrowLeft, RefreshCw, TicketX, Shield } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Motion } from "@legendapp/motion";
import { useTicketStore } from "@/lib/stores/ticket-store";
import type { TicketTierLevel } from "@/lib/stores/ticket-store";
import {
  TicketHeroCard,
  TicketQRCode,
  TicketAccessDetails,
  TicketActionsBar,
} from "@/src/ticket/ui";

const TIER_ACCENT: Record<TicketTierLevel, string> = {
  free: "#3FDCFF",
  ga: "#34A2DF",
  vip: "#8A40CF",
  table: "#FF5BFC",
};

export default function ViewTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getTicketByEventId } = useTicketStore();

  const eventId = id || "lower-east-side-winter-bar-fest";
  const ticket = getTicketByEventId(eventId);

  // ── Loading state ──
  // Ticket store is synchronous, but guard for missing data
  if (!ticket) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>

        <View style={styles.emptyContainer}>
          <TicketX size={56} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>Ticket Not Found</Text>
          <Text style={styles.emptySubtitle}>
            This ticket may have been removed or is no longer available.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <RefreshCw size={16} color="#fff" />
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tier = ticket.tier || "ga";
  const accent = TIER_ACCENT[tier];
  const isExpired = ticket.status === "expired";
  const isRevoked = ticket.status === "revoked";

  return (
    <View style={styles.screen}>
      {/* Back button overlay */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <ArrowLeft size={22} color="#fff" />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ── 1. TICKET HERO ── */}
        <View style={styles.heroWrap}>
          <TicketHeroCard ticket={ticket} />
        </View>

        {/* ── Expired / Revoked banner ── */}
        {(isExpired || isRevoked) && (
          <Motion.View
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={[
              styles.statusBanner,
              {
                backgroundColor: isRevoked
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(163,163,163,0.1)",
                borderColor: isRevoked
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(163,163,163,0.15)",
              },
            ]}
          >
            <Shield size={16} color={isRevoked ? "#ef4444" : "#a3a3a3"} />
            <Text
              style={[
                styles.statusBannerText,
                { color: isRevoked ? "#ef4444" : "#a3a3a3" },
              ]}
            >
              {isRevoked
                ? "This ticket has been revoked"
                : "This event has ended"}
            </Text>
          </Motion.View>
        )}

        {/* ── Tear line separator ── */}
        <View style={styles.tearLine}>
          <View style={styles.tearCircleLeft} />
          {Array.from({ length: 24 }).map((_, i) => (
            <View
              key={i}
              style={[styles.tearDash, { backgroundColor: `${accent}30` }]}
            />
          ))}
          <View style={styles.tearCircleRight} />
        </View>

        {/* ── 2. QR CODE ZONE ── */}
        <TicketQRCode ticket={ticket} />

        {/* ── Transferable / Non-transferable label ── */}
        <View style={styles.transferRow}>
          <View
            style={[
              styles.transferBadge,
              {
                borderColor: ticket.transferable
                  ? "rgba(63,220,255,0.2)"
                  : "rgba(255,255,255,0.08)",
              },
            ]}
          >
            <Text
              style={[
                styles.transferText,
                {
                  color: ticket.transferable
                    ? "#3FDCFF"
                    : "rgba(255,255,255,0.25)",
                },
              ]}
            >
              {ticket.transferable ? "Transferable" : "Non-transferable"}
            </Text>
          </View>
        </View>

        {/* ── 3. ACCESS DETAILS ── */}
        <TicketAccessDetails ticket={ticket} />
      </ScrollView>

      {/* ── 5. ACTIONS BAR (sticky bottom) ── */}
      <TicketActionsBar ticket={ticket} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingTop: 0,
  },
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tearLine: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 8,
    position: "relative",
  },
  tearCircleLeft: {
    position: "absolute",
    left: -28,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0a0a0a",
  },
  tearCircleRight: {
    position: "absolute",
    right: -28,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0a0a0a",
  },
  tearDash: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  transferRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  transferBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  transferText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Empty / error states
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
