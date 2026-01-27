/**
 * Event Organizer Screen
 *
 * Allows event organizers to:
 * - View all tickets for the event
 * - Scan QR codes to check in tickets
 * - See check-in status
 */

import React, { useState, useEffect } from "react";
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
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { tickets } from "@/lib/api-client";
import { TicketQRScanner } from "@/components/ticket-qr-scanner";
import { useUIStore } from "@/lib/stores/ui-store";

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

  const loadTickets = async () => {
    try {
      const result = await tickets.getEventTickets<Ticket>(eventId);
      setEventTickets(result.tickets || []);
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

      {/* Scan Button */}
      <View style={{ padding: 16 }}>
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
