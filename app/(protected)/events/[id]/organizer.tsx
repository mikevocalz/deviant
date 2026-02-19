/**
 * Event Organizer Screen
 *
 * Allows event organizers to:
 * - View all tickets for the event
 * - Scan QR codes to check in tickets
 * - See check-in status
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  User,
  Settings,
  WifiOff,
  CloudUpload,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { tickets } from "@/lib/api/tickets";
import { ticketsApi } from "@/lib/api/tickets";
import { TicketQRScanner } from "@/components/ticket-qr-scanner";
import { useUIStore } from "@/lib/stores/ui-store";
import { useOfflineCheckinStore } from "@/lib/stores/offline-checkin-store";

interface Ticket {
  id: string;
  user?: {
    username?: string;
    name?: string;
    avatar?: string;
  };
  status: "valid" | "checked_in" | "revoked";
  checkedInAt?: string;
  createdAt: string;
}

export default function EventOrganizerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const showToast = useUIStore((s) => s.showToast);
  const [eventTickets, setEventTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const eventId = id || "";

  // Offline check-in state
  const offlineStore = useOfflineCheckinStore();
  const hasOfflineData = offlineStore.hasOfflineData(eventId);
  const pendingScans = offlineStore.pendingScans.filter(
    (s) => s.eventId === eventId,
  );
  const lastDownloaded = offlineStore.lastDownloaded[eventId];
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDownloadForOffline = useCallback(async () => {
    setIsDownloading(true);
    try {
      const tokens = await ticketsApi.downloadOfflineTokens(eventId);
      if (tokens.length > 0) {
        offlineStore.setTokensForEvent(eventId, tokens);
        showToast(
          "success",
          "Downloaded",
          `${tokens.length} tickets ready for offline scanning`,
        );
      } else {
        showToast("info", "No Tickets", "No active tickets to download");
      }
    } catch (err) {
      console.error("[Organizer] Download offline tokens error:", err);
      showToast("error", "Error", "Failed to download tickets for offline use");
    } finally {
      setIsDownloading(false);
    }
  }, [eventId, offlineStore, showToast]);

  const handleSyncPendingScans = useCallback(async () => {
    if (pendingScans.length === 0) return;
    setIsSyncing(true);
    try {
      const result = await ticketsApi.syncOfflineScans(pendingScans);
      if (result.synced.length > 0) {
        offlineStore.removePendingScans(eventId, result.synced);
        showToast(
          "success",
          "Synced",
          `${result.synced.length} offline scan(s) synced`,
        );
        loadTickets(); // refresh ticket list
      }
      if (result.failed.length > 0) {
        showToast(
          "error",
          "Sync Partial",
          `${result.failed.length} scan(s) failed to sync`,
        );
      }
    } catch (err) {
      console.error("[Organizer] Sync error:", err);
      showToast("error", "Error", "Failed to sync offline scans");
    } finally {
      setIsSyncing(false);
    }
  }, [pendingScans, eventId, offlineStore, showToast]);

  const loadTickets = async () => {
    try {
      const result = await tickets.getEventTickets(eventId);
      setEventTickets((result as any) || []);
    } catch (error: any) {
      console.error("[Organizer] Load tickets error:", error);
      const errorMessage = error?.error || "Failed to load tickets";
      showToast("error", "Error", errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [eventId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTickets();
  };

  const handleCheckInSuccess = () => {
    // Reload tickets after successful check-in
    loadTickets();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const checkedInCount = eventTickets.filter(
    (t) => t.status === "checked_in",
  ).length;
  const totalCount = eventTickets.length;

  if (showScanner) {
    return (
      <TicketQRScanner
        eventId={eventId}
        onClose={() => setShowScanner(false)}
        onCheckInSuccess={handleCheckInSuccess}
      />
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            marginLeft: 16,
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
          }}
        >
          Event Tickets
        </Text>
        <Pressable
          onPress={() =>
            router.push("/(protected)/events/organizer-setup" as any)
          }
          hitSlop={12}
        >
          <Settings size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Stats Bar */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: colors.foreground,
            }}
          >
            {totalCount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedForeground,
              marginTop: 4,
            }}
          >
            Total Tickets
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#22c55e" }}>
            {checkedInCount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedForeground,
              marginTop: 4,
            }}
          >
            Checked In
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{ fontSize: 24, fontWeight: "bold", color: colors.primary }}
          >
            {totalCount - checkedInCount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedForeground,
              marginTop: 4,
            }}
          >
            Remaining
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ padding: 16, gap: 10 }}>
        {/* Scan Button */}
        <Pressable
          onPress={() => setShowScanner(true)}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <QrCode size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            Scan QR Code
          </Text>
        </Pressable>

        {/* Download for Offline / Sync Row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={handleDownloadForOffline}
            disabled={isDownloading}
            style={{
              flex: 1,
              backgroundColor: hasOfflineData
                ? "rgba(34,197,94,0.1)"
                : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: hasOfflineData
                ? "rgba(34,197,94,0.3)"
                : colors.border,
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <WifiOff
                size={16}
                color={hasOfflineData ? "#22c55e" : colors.mutedForeground}
              />
            )}
            <Text
              style={{
                color: hasOfflineData ? "#22c55e" : colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {hasOfflineData ? "Offline Ready" : "Download Offline"}
            </Text>
          </Pressable>

          {pendingScans.length > 0 && (
            <Pressable
              onPress={handleSyncPendingScans}
              disabled={isSyncing}
              style={{
                flex: 1,
                backgroundColor: "rgba(249,115,22,0.1)",
                borderWidth: 1,
                borderColor: "rgba(249,115,22,0.3)",
                paddingVertical: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <CloudUpload size={16} color="#f97316" />
              )}
              <Text
                style={{ color: "#f97316", fontSize: 13, fontWeight: "600" }}
              >
                Sync {pendingScans.length} Scan
                {pendingScans.length !== 1 ? "s" : ""}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Offline status info */}
        {hasOfflineData && lastDownloaded && (
          <Text
            style={{
              fontSize: 11,
              color: colors.mutedForeground,
              textAlign: "center",
            }}
          >
            Last downloaded:{" "}
            {new Date(lastDownloaded).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>

      {/* Tickets List */}
      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {eventTickets.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingTop: 60,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.mutedForeground }}>
                No tickets yet
              </Text>
            </View>
          ) : (
            <View style={{ padding: 16, gap: 12 }}>
              {eventTickets.map((ticket) => (
                <View
                  key={ticket.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: colors.muted,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <User size={20} color={colors.foreground} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: colors.foreground,
                          }}
                        >
                          {ticket.user?.name ||
                            ticket.user?.username ||
                            "Guest"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.mutedForeground,
                          }}
                        >
                          {ticket.id}
                        </Text>
                      </View>
                    </View>

                    {ticket.status === "checked_in" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "#22c55e20",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                        }}
                      >
                        <CheckCircle size={16} color="#22c55e" />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: "#22c55e",
                          }}
                        >
                          Checked In
                        </Text>
                      </View>
                    ) : ticket.status === "revoked" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "#ef444420",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                        }}
                      >
                        <XCircle size={16} color="#ef4444" />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: "#ef4444",
                          }}
                        >
                          Revoked
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: colors.muted,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                        }}
                      >
                        <Clock size={16} color={colors.mutedForeground} />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: colors.mutedForeground,
                          }}
                        >
                          Valid
                        </Text>
                      </View>
                    )}
                  </View>

                  {ticket.checkedInAt && (
                    <Text
                      style={{ fontSize: 12, color: colors.mutedForeground }}
                    >
                      Checked in: {formatDate(ticket.checkedInAt)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
