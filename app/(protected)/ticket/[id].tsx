import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { X, Calendar, MapPin, Clock, CheckCircle, AlertCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useTicketStore } from "@/lib/stores/ticket-store";
import QRCode from "@/components/qr-code";

export default function TicketModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { getTicketByEventId } = useTicketStore();

  const eventId = id || "lower-east-side-winter-bar-fest";
  
  // Get ticket from store or create a mock one
  const ticket = getTicketByEventId(eventId) || {
    id: `ticket-${eventId}`,
    eventId: eventId,
    userId: "current-user",
    paid: true,
    status: "valid" as const,
    qrToken: `mock-token-${eventId}`,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusInfo = () => {
    switch (ticket?.status) {
      case "checked_in":
        return {
          label: "Checked In",
          color: "#22c55e",
          icon: CheckCircle,
        };
      case "revoked":
        return {
          label: "Revoked",
          color: "#ef4444",
          icon: AlertCircle,
        };
      default:
        return {
          label: "Valid",
          color: "#22c55e",
          icon: CheckCircle,
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View 
        className="flex-row items-center justify-between px-5 py-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-xl font-bold text-foreground">Your Ticket</Text>
        <Pressable onPress={() => router.back()} className="w-10 h-10 bg-card rounded-full items-center justify-center">
          <X size={24} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-5">
        <View className="rounded-2xl overflow-hidden shadow-lg">
          <LinearGradient
            colors={["#1A1A28", "#252538"]}
            className="p-5"
          >
            <View className="mb-4">
              <View className="gap-3">
                <Text className="text-2xl font-extrabold text-white leading-tight" numberOfLines={2}>
                  {ticket.eventId}
                </Text>
                <View 
                  className="flex-row items-center self-start px-3 py-1.5 rounded-full gap-1.5"
                  style={{ backgroundColor: `${statusInfo.color}20` }}
                >
                  <StatusIcon size={14} color={statusInfo.color} />
                  <Text className="text-sm font-semibold" style={{ color: statusInfo.color }}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center my-5 relative">
              <View className="absolute -left-8 w-5 h-5 bg-background rounded-full" />
              {[...Array(20)].map((_, i) => (
                <View key={i} className="flex-1 h-0.5 bg-white/20 mx-0.5 rounded-full" />
              ))}
              <View className="absolute -right-8 w-5 h-5 bg-background rounded-full" />
            </View>

            <View className="items-center mb-5">
              <View className="p-4 bg-white rounded-2xl shadow-md">
                <QRCode
                  value={ticket.qrToken || ""}
                  size={200}
                  backgroundColor="#FFFFFF"
                  foregroundColor="#000000"
                  logo={true}
                  logoSize={48}
                  logoBackgroundColor="#FFFFFF"
                />
              </View>
              <Text className="mt-3 text-sm text-white/60 font-medium">
                Scan this QR code at the venue
              </Text>
            </View>

            <View className="bg-white/10 rounded-2xl p-4 gap-3 mb-4">
              <View className="flex-row gap-3">
                <View className="flex-1 flex-row items-start gap-2.5">
                  <Calendar size={16} color="#3b82f6" />
                  <View>
                    <Text className="text-xs text-white/60 font-medium uppercase tracking-wide">Date</Text>
                    <Text className="text-sm text-white font-semibold mt-0.5">Coming Soon</Text>
                  </View>
                </View>
                <View className="flex-1 flex-row items-start gap-2.5">
                  <Clock size={16} color="#3b82f6" />
                  <View>
                    <Text className="text-xs text-white/60 font-medium uppercase tracking-wide">Time</Text>
                    <Text className="text-sm text-white font-semibold mt-0.5">TBD</Text>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 flex-row items-start gap-2.5">
                  <MapPin size={16} color="#3b82f6" />
                  <View className="flex-1">
                    <Text className="text-xs text-white/60 font-medium uppercase tracking-wide">Location</Text>
                    <Text className="text-sm text-white font-semibold mt-0.5" numberOfLines={1}>New York, NY</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="items-center">
              <View className="items-center">
                <Text className="text-xs text-white/60 font-medium uppercase tracking-wide mb-1">Ticket ID</Text>
                <Text className="text-sm text-white/80 font-bold tracking-widest font-mono">
                  {ticket.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {ticket.status === "checked_in" && ticket.checkedInAt && (
          <View className="flex-row items-center gap-2.5 mt-4 p-3.5 bg-green-500/15 rounded-2xl">
            <CheckCircle size={18} color="#22c55e" />
            <Text className="flex-1 text-sm text-green-500 font-medium">
              Checked in on {formatDate(ticket.checkedInAt)} at {formatTime(ticket.checkedInAt)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
