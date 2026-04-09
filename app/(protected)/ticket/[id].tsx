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
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  ArrowLeft,
  RefreshCw,
  TicketX,
  Shield,
  WalletCards,
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
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { addToWallet } from "@/src/ticket/helpers";
import { useUIStore } from "@/lib/stores/ui-store";

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
    transferable: true, // Default to transferable for all tickets
  };
}

function ViewTicketScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const eventId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");
  const { data: dbTicket, isLoading, isError } = useMyTicketForEvent(eventId);

  // Also check Zustand store as fallback (for recently RSVPed tickets not yet in DB)
  const storeTicket = useTicketStore((s) => s.getTicketByEventId(eventId));
  const ticket: Ticket | undefined = dbTicket
    ? dbToTicket(dbTicket)
    : storeTicket;
  const showToast = useUIStore((s) => s.showToast);
  const [walletState, setWalletState] = React.useState<
    "idle" | "loading" | "success"
  >("idle");

  // ── Loading state ──
  if (isLoading && !ticket) {
    return <ScreenSkeleton variant="detail" rows={6} />;
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
  const canAddToWallet =
    ticket.status === "valid" &&
    (Platform.OS === "ios" || Platform.OS === "android");

  const handleAddToWallet = React.useCallback(async () => {
    if (!canAddToWallet || walletState === "loading") return;

    setWalletState("loading");
    const result = await addToWallet(ticket);

    if (result.success) {
      setWalletState("success");
      showToast(
        "success",
        "Wallet",
        Platform.OS === "ios"
          ? "Apple Wallet opened"
          : "Google Wallet opened",
      );
      setTimeout(() => setWalletState("idle"), 2500);
      return;
    }

    setWalletState("idle");

    const errorMessage =
      result.error === "not_authenticated"
        ? "Please sign in again"
        : result.error === "not_configured" ||
            result.error === "not_implemented"
          ? "Wallet is not configured yet"
          : result.error === "apple_wallet_ios_only" ||
              result.error === "google_wallet_android_only" ||
              result.error === "unsupported_platform"
            ? "Wallet is not available on this device"
            : "Could not open wallet pass";

    showToast("error", "Wallet", errorMessage);
  }, [canAddToWallet, showToast, ticket, walletState]);

  const walletTitle =
    walletState === "loading"
      ? "Opening Wallet"
      : walletState === "success"
        ? "Wallet Ready"
        : "Add to Wallet";

  const walletSubtitle =
    walletState === "success"
      ? "Pass opened successfully"
      : Platform.OS === "ios"
        ? "Save your Apple Wallet pass"
        : "Save your Google Wallet pass";
  const bottomActionsPadding = canAddToWallet ? insets.bottom + 176 : 116;

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
          { paddingBottom: bottomActionsPadding },
        ]}
      >
        {/* ── 1. TICKET HERO ── */}
        <View style={styles.heroWrap}>
          <TicketHeroCard ticket={ticket} />
        </View>

        <View>
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
                  borderColor:
                    (ticket.transferable ?? true)
                      ? "rgba(63,220,255,0.2)"
                      : "rgba(255,255,255,0.08)",
                },
              ]}
            >
              <Text
                style={[
                  styles.transferText,
                  {
                    color:
                      (ticket.transferable ?? true)
                        ? "#3FDCFF"
                        : "rgba(255,255,255,0.25)",
                  },
                ]}
              >
                {(ticket.transferable ?? true)
                  ? "Transferable"
                  : "Non-transferable"}
              </Text>
            </View>
          </View>

          {/* ── 3. ACCESS DETAILS ── */}
          <TicketAccessDetails ticket={ticket} />
        </View>
      </ScrollView>

      <View style={styles.bottomActionsWrap}>
        <TicketActionsBar
          ticket={ticket}
          bottomInset={0}
          style={styles.ticketActionsBar}
        />

        {canAddToWallet && (
          <Pressable
            onPress={handleAddToWallet}
            disabled={walletState === "loading"}
            style={({ pressed }) => [
              styles.walletBanner,
              styles.walletBottomCta,
              pressed && walletState !== "loading" && styles.walletBannerPressed,
              walletState === "success" && styles.walletBannerSuccess,
              { marginBottom: insets.bottom + 8 },
            ]}
          >
            <View style={styles.walletIconWrap}>
              {walletState === "loading" ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <WalletCards size={22} color={accent} />
              )}
            </View>

            <View style={styles.walletBannerTextWrap}>
              <Text style={styles.walletBannerTitle}>{walletTitle}</Text>
              <Text style={styles.walletBannerSubtitle}>{walletSubtitle}</Text>
            </View>

            <Text
              style={[
                styles.walletBannerMeta,
                walletState === "success" && styles.walletBannerMetaSuccess,
              ]}
            >
              {walletState === "success" ? "Done" : "Open"}
            </Text>
          </Pressable>
        )}
      </View>
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
  bottomActionsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,10,0.96)",
  },
  ticketActionsBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
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
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  walletBottomCta: {
    marginTop: 10,
  },
  walletBannerPressed: {
    opacity: 0.92,
  },
  walletBannerSuccess: {
    backgroundColor: "rgba(63,220,255,0.08)",
    borderColor: "rgba(63,220,255,0.18)",
  },
  walletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(138,64,207,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  walletBannerTextWrap: {
    flex: 1,
  },
  walletBannerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  walletBannerSubtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  walletBannerMeta: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  walletBannerMetaSuccess: {
    color: "#3FDCFF",
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
