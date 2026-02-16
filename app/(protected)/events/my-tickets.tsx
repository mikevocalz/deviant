/**
 * My Tickets Screen
 *
 * Lists all tickets the current user has purchased.
 * Tapping a ticket navigates to the ticket detail/QR view.
 * Feature-gated behind ticketing_enabled.
 */

import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ArrowLeft, Ticket, QrCode, Calendar, MapPin } from "lucide-react-native";
import { Image } from "expo-image";
import { LegendList } from "@/components/list";
import { useMyTickets } from "@/lib/hooks/use-tickets";
import { FeatureGate } from "@/lib/feature-flags";
import type { TicketRecord } from "@/lib/api/tickets";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E", label: "Active" },
  scanned: { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6", label: "Used" },
  refunded: { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444", label: "Refunded" },
  void: { bg: "rgba(107, 114, 128, 0.15)", text: "#6B7280", label: "Void" },
};

function TicketCard({ ticket, index }: { ticket: TicketRecord; index: number }) {
  const router = useRouter();
  const status = STATUS_COLORS[ticket.status] || STATUS_COLORS.void;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300).springify().damping(18)}>
      <Pressable
        onPress={() => router.push(`/(protected)/ticket/${ticket.event_id}` as any)}
        className="mx-4 mb-3 bg-card rounded-2xl border border-border overflow-hidden"
      >
        <View className="flex-row">
          {/* Event image */}
          {ticket.event_image ? (
            <Image
              source={{ uri: ticket.event_image }}
              style={{ width: 80, height: 100 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-20 h-[100px] bg-muted items-center justify-center">
              <Ticket size={24} color="#666" />
            </View>
          )}

          {/* Info */}
          <View className="flex-1 p-3 justify-between">
            <View>
              <Text className="text-sm font-sans-bold text-foreground" numberOfLines={1}>
                {ticket.event_title || "Event"}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                {ticket.ticket_type_name}
              </Text>
            </View>

            <View className="flex-row items-center gap-3 mt-2">
              {ticket.event_date && (
                <View className="flex-row items-center gap-1">
                  <Calendar size={10} color="#999" />
                  <Text className="text-[10px] text-muted-foreground">
                    {new Date(ticket.event_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              )}
              {ticket.event_location && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={10} color="#999" />
                  <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                    {ticket.event_location}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Status + QR */}
          <View className="items-center justify-center px-3 gap-2">
            <View
              style={{ backgroundColor: status.bg }}
              className="rounded-full px-2 py-0.5"
            >
              <Text style={{ color: status.text }} className="text-[10px] font-sans-semibold">
                {status.label}
              </Text>
            </View>
            {ticket.status === "active" && (
              <QrCode size={20} color="#8A40CF" />
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MyTicketsContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: tickets, isLoading, isError, refetch } = useMyTickets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          My Tickets
        </Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      )}

      {isError && (
        <View className="flex-1 items-center justify-center px-8">
          <Ticket size={48} color="rgba(255,255,255,0.15)" />
          <Text className="text-muted-foreground mt-3 text-center">
            Failed to load tickets. Pull down to retry.
          </Text>
        </View>
      )}

      {!isLoading && !isError && (!tickets || tickets.length === 0) && (
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-1 items-center justify-center px-8"
        >
          <Ticket size={56} color="rgba(255,255,255,0.1)" />
          <Text className="text-lg font-sans-semibold text-foreground mt-4">
            No tickets yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Your purchased tickets will appear here
          </Text>
          <Pressable
            onPress={() => router.push("/(protected)/(tabs)/events" as any)}
            className="mt-6 bg-primary rounded-full px-6 py-3"
          >
            <Text className="text-primary-foreground font-sans-semibold">
              Browse Events
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {tickets && tickets.length > 0 && (
        <LegendList
          data={tickets}
          keyExtractor={(item: TicketRecord) => item.id}
          renderItem={({ item, index }: { item: TicketRecord; index: number }) => (
            <TicketCard ticket={item} index={index} />
          )}
          estimatedItemSize={110}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 20 }}
          onRefresh={refetch}
          refreshing={false}
        />
      )}
    </View>
  );
}

export default function MyTicketsScreen() {
  return (
    <FeatureGate
      flag="ticketing_enabled"
      fallback={
        <View className="flex-1 bg-background items-center justify-center">
          <Text className="text-muted-foreground">Tickets coming soon</Text>
        </View>
      }
    >
      <MyTicketsContent />
    </FeatureGate>
  );
}
