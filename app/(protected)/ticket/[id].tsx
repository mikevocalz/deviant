/**
 * View Ticket — Luxury Digital Pass
 * posh.vip-style VIP ticket with glassmorphism, tier accents, and animated QR
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import {
  ArrowLeft,
  RefreshCw,
  TicketX,
  Shield,
  Wallet,
  Check,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { Motion } from "@legendapp/motion";
import { useTicketStore } from "@/lib/stores/ticket-store";
import type { Ticket, TicketTierLevel } from "@/lib/stores/ticket-store";
import { useMyTicketForEvent } from "@/lib/hooks/use-tickets";
import type { TicketRecord } from "@/lib/api/tickets";
import {
  TicketHeroCard,
  TicketQRCode,
  TicketAccessDetails,
  TicketActionsBar,
} from "@/src/ticket/ui";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/lib/stores/ui-store";
import { addToAppleWallet } from "@/src/ticket/helpers/add-to-wallet";

const TIER_ACCENT: Record<TicketTierLevel, string> = {
  free: "#3FDCFF",
  ga: "#34A2DF",
  vip: "#8A40CF",
  table: "#FF5BFC",
};

/** Map a DB TicketRecord → the Ticket shape used by UI components */
function dbToTicket(rec: TicketRecord): Ticket {
  const normalizedTierName = (rec.ticket_type_name || "").toLowerCase();

  return {
    id: rec.id,
    eventId: String(rec.event_id),
    userId: rec.user_id,
    paid: (rec.purchase_amount_cents ?? 0) > 0,
    status:
      rec.status === "active"
        ? "valid"
        : rec.status === "scanned"
          ? "checked_in"
          : rec.status === "refunded"
            ? "revoked"
            : rec.status === "transfer_pending"
              ? "transfer_pending"
              : "expired",
    checkedInAt: rec.checked_in_at ?? undefined,
    qrToken: rec.qr_token,
    tier: (normalizedTierName.includes("vip")
      ? "vip"
      : normalizedTierName.includes("table")
        ? "table"
        : (rec.purchase_amount_cents ?? 0) === 0
          ? "free"
          : "ga") as TicketTierLevel,
    tierName: rec.ticket_type_name || "General Admission",
    eventTitle: rec.event_title || "",
    eventDate: rec.event_date || "",
    eventLocation: rec.event_location || "",
    eventImage: rec.event_image || "",
  };
}

function ViewTicketScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const eventId = id || "";
  const { data: dbTicket, isLoading, isError } = useMyTicketForEvent(eventId);

  // Also check Zustand store as fallback (for recently RSVPed tickets not yet in DB)
  const storeTicket = useTicketStore((s) => s.getTicketByEventId(eventId));
  const ticket: Ticket | undefined = dbTicket
    ? dbToTicket(dbTicket)
    : storeTicket;

  // ── Loading state ──
  if (isLoading && !ticket) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#8A40CF" />
        </View>
      </View>
    );
  }

  // ── Not found / error state ──
  if (!ticket) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color="#fff" />
        </Pressable>

        <View style={styles.emptyContainer}>
          <TicketX size={56} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>Ticket Not Found</Text>
          <Text style={styles.emptySubtitle}>
            This ticket may have been removed or is no longer available.
          </Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.retryButton}
          >
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
  const isTransferPending = ticket.status === "transfer_pending";
  const showToast = useUIStore((s) => s.showToast);

  // ── Apple Wallet banner state ──
  const [walletBannerState, setWalletBannerState] = useState<
    "idle" | "loading" | "success" | "dismissed"
  >("idle");
  const showWalletBanner =
    Platform.OS === "ios" &&
    ticket.status === "valid" &&
    walletBannerState !== "dismissed" &&
    walletBannerState !== "success";

  const handleWalletBanner = useCallback(async () => {
    if (walletBannerState === "loading") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWalletBannerState("loading");
    const result = await addToAppleWallet(ticket);
    if (result.success) {
      setWalletBannerState("success");
      showToast("success", "Added", "Ticket saved to Apple Wallet");
    } else {
      setWalletBannerState("idle");
      if (
        result.error === "not_configured" ||
        result.error === "not_implemented"
      ) {
        showToast("info", "Coming Soon", "Apple Wallet passes coming soon");
        setWalletBannerState("dismissed");
      } else {
        showToast("error", "Wallet", "Could not add to wallet");
      }
    }
  }, [ticket, walletBannerState, showToast]);

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

        {/* ── Apple Wallet banner (iOS only, active tickets) ── */}
        {showWalletBanner && (
          <Motion.View
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <Pressable
              onPress={handleWalletBanner}
              disabled={walletBannerState === "loading"}
              style={styles.walletBanner}
            >
              {walletBannerState === "loading" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Wallet size={18} color="#fff" />
              )}
              <View style={styles.walletBannerTextWrap}>
                <Text style={styles.walletBannerTitle}>
                  Add to Apple Wallet
                </Text>
                <Text style={styles.walletBannerSubtitle}>
                  Quick access at the door
                </Text>
              </View>
              <View style={styles.walletBannerArrow}>
                <Text style={styles.walletBannerArrowText}>+</Text>
              </View>
            </Pressable>
          </Motion.View>
        )}

        {/* ── Transfer Pending banner ── */}
        {isTransferPending && (
          <Motion.View
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={[
              styles.statusBanner,
              {
                backgroundColor: "rgba(138,64,207,0.12)",
                borderColor: "rgba(138,64,207,0.2)",
              },
            ]}
          >
            <Shield size={16} color="#8A40CF" />
            <Text style={[styles.statusBannerText, { color: "#8A40CF" }]}>
              Transfer pending — waiting for recipient to accept
            </Text>
          </Motion.View>
        )}

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
  walletBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(138,64,207,0.15)",
    borderWidth: 1,
    borderColor: "rgba(138,64,207,0.25)",
  },
  walletBannerTextWrap: {
    flex: 1,
  },
  walletBannerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  walletBannerSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  walletBannerArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(138,64,207,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  walletBannerArrowText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
});

// Wrap with ErrorBoundary for crash protection
export default function ViewTicketScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary screenName="ViewTicket" onGoBack={() => router.back()}>
      <ViewTicketScreenContent />
    </ErrorBoundary>
  );
}
