/**
 * TicketActionsBar — Sticky bottom actions
 * Calendar, Share, Transfer — respects ticket rules
 * Loading, success, error states for each action.
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, Share2, Check, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/lib/stores/ui-store";
import { addTicketToCalendar } from "@/src/ticket/helpers/add-to-calendar";
import { shareTicket } from "@/src/ticket/helpers/share-ticket";
import { ticketsApi } from "@/lib/api/tickets";
import type { Ticket, TicketTierLevel } from "@/lib/stores/ticket-store";

interface TicketActionsBarProps {
  ticket: Ticket;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}

const TIER_ACCENT: Record<TicketTierLevel, string> = {
  free: "#3FDCFF",
  ga: "#34A2DF",
  vip: "#8A40CF",
  table: "#FF5BFC",
};

type ActionState = "idle" | "loading" | "success" | "error";

export const TicketActionsBar = memo(function TicketActionsBar({
  ticket,
  bottomInset,
  style,
}: TicketActionsBarProps) {
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const tier = ticket.tier || "ga";
  const accent = TIER_ACCENT[tier];

  const isActive = ticket.status === "valid";

  // Diag — one log per mount so we know the bar rendered at all
  useEffect(() => {
    console.log(
      "[TicketActionsBar] mounted — ticket.id=",
      ticket.id,
      "status=",
      ticket.status,
      "transferable=",
      ticket.transferable,
    );
  }, [ticket.id, ticket.status, ticket.transferable]);

  const [calendarState, setCalendarState] = useState<ActionState>("idle");
  const [shareState, setShareState] = useState<ActionState>("idle");
  const [transferState, setTransferState] = useState<ActionState>("idle");

  // ── Calendar ──
  const handleCalendar = useCallback(async () => {
    console.log("[TicketActionsBar] Calendar tap — ticket.id=", ticket.id);
    if (calendarState === "loading") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
    );
    setCalendarState("loading");

    const result = await addTicketToCalendar(ticket);
    console.log("[TicketActionsBar] Calendar result:", result);

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
    console.log("[TicketActionsBar] Share tap — ticket.id=", ticket.id);
    if (shareState === "loading") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
    );
    setShareState("loading");

    const result = await shareTicket(ticket);
    console.log("[TicketActionsBar] Share result:", result);

    if (result.success) {
      setShareState("idle");
    } else {
      setShareState("error");
      showToast("error", "Share", "Could not share ticket");
      setTimeout(() => setShareState("idle"), 3000);
    }
  }, [ticket, shareState, showToast]);

  // ── Transfer ──
  const transferInputRef = useRef<TextInput>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUsername, setTransferUsername] = useState("");

  const handleTransfer = useCallback(() => {
    console.log("[TicketActionsBar] Transfer tap — ticket.id=", ticket.id);
    if (transferState === "loading") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
    );
    setTransferUsername("");
    setShowTransferModal(true);
  }, [transferState, ticket.id]);

  const handleTransferSubmit = useCallback(async () => {
    const username = transferUsername.trim();
    if (!username) {
      showToast("error", "Error", "Please enter a username");
      return;
    }
    setShowTransferModal(false);
    setTransferState("loading");
    const result = await ticketsApi.initiateTransfer(ticket.id, username);
    if (result.error) {
      setTransferState("error");
      showToast("error", "Transfer Failed", result.error);
      setTimeout(() => setTransferState("idle"), 3000);
    } else {
      setTransferState("success");
      showToast(
        "success",
        "Transfer Initiated",
        `Waiting for @${username} to accept (expires in 24h)`,
      );
      setTimeout(() => setTransferState("idle"), 3000);
    }
  }, [ticket, transferUsername, showToast]);

  if (!isActive) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: bottomInset ?? insets.bottom + 8 },
        style,
      ]}
    >
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
          <Check size={16} color="#3FDCFF" />
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
        onPressIn={() => console.log("[TicketActionsBar] Share onPressIn")}
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

      {/* Transfer */}
      <Pressable
        onPress={handleTransfer}
        onPressIn={() => console.log("[TicketActionsBar] Transfer onPressIn")}
        style={[
          styles.actionButton,
          transferState === "success" && styles.successButton,
        ]}
        disabled={transferState === "loading"}
      >
        {transferState === "loading" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : transferState === "success" ? (
          <Check size={16} color="#3FDCFF" />
        ) : (
          <Send size={16} color="#fff" />
        )}
        <Text
          style={[
            styles.actionLabel,
            transferState === "success" && styles.successLabel,
          ]}
          numberOfLines={1}
        >
          {transferState === "success" ? "Sent" : "Transfer"}
        </Text>
      </Pressable>

      {/* Transfer username modal */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTransferModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKAV}
          >
            <Pressable style={styles.sheetContent} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>Transfer Ticket</Text>
              <Text style={styles.modalSubtitle}>
                Enter the username of the person you want to transfer this ticket to.
              </Text>
              <TextInput
                ref={transferInputRef}
                style={styles.modalInput}
                placeholder="Username"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={transferUsername}
                onChangeText={setTransferUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                autoFocus
                onSubmitEditing={() => {
                  if (showTransferModal) handleTransferSubmit();
                }}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setShowTransferModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitBtn, { backgroundColor: accent }]}
                  onPress={handleTransferSubmit}
                >
                  <Text style={styles.modalSubmitText}>Transfer</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
    backgroundColor: "rgba(63,220,255,0.1)",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  successLabel: {
    color: "#3FDCFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalKAV: {
    justifyContent: "flex-end",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalCancelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
