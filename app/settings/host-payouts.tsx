/**
 * Host Payout History Screen
 *
 * Lists all payouts to the organizer's bank with status chips,
 * amounts, event names, and arrival dates.
 */

import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeft,
  Banknote,
  AlertCircle,
  Calendar,
  Building2,
} from "lucide-react-native";
import { LegendList } from "@/components/list";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { hostPayoutsApi } from "@/lib/api/payments";
import {
  PAYOUT_STATUS_CONFIG,
  type PayoutRecord,
} from "@/lib/types/payments";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function HostPayoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    payouts,
    payoutsLoading,
    setPayouts,
    setPayoutsLoading,
  } = usePaymentsStore();

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const result = await hostPayoutsApi.listPayouts();
      setPayouts(result.data);
    } catch (err) {
      console.error("[HostPayouts] load error:", err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [setPayouts, setPayoutsLoading]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Payout History
        </Text>
      </View>

      {payoutsLoading && payouts.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      )}

      {!payoutsLoading && payouts.length === 0 && (
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-1 items-center justify-center px-8"
        >
          <Banknote size={56} color="rgba(255,255,255,0.1)" />
          <Text className="text-lg font-sans-semibold text-foreground mt-4">
            No payouts yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Payouts are released after your events end
          </Text>
        </Animated.View>
      )}

      {payouts.length > 0 && (
        <LegendList
          data={payouts}
          keyExtractor={(item: PayoutRecord) => item.id}
          renderItem={({ item, index }: { item: PayoutRecord; index: number }) => (
            <PayoutCard payout={item} index={index} />
          )}
          estimatedItemSize={100}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 20,
          }}
          onRefresh={loadPayouts}
          refreshing={payoutsLoading}
        />
      )}
    </View>
  );
}

function PayoutCard({ payout, index }: { payout: PayoutRecord; index: number }) {
  const statusConfig =
    PAYOUT_STATUS_CONFIG[payout.status] || PAYOUT_STATUS_CONFIG.pending;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300).springify().damping(18)}
    >
      <View className="mx-4 mb-3 bg-card rounded-2xl border border-border p-4">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text
              className="text-[15px] font-sans-semibold text-foreground"
              numberOfLines={1}
            >
              {payout.eventTitle}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Calendar size={12} color="#666" />
              <Text className="text-xs text-muted-foreground">
                Released {formatDate(payout.releaseAt)}
              </Text>
            </View>
          </View>
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: statusConfig.bg }}
          >
            <Text
              className="text-[10px] font-sans-bold"
              style={{ color: statusConfig.text }}
            >
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
          <View>
            <Text className="text-xs text-muted-foreground">Net Payout</Text>
            <Text className="text-lg font-sans-bold text-green-400">
              {formatCents(payout.netCents)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">Gross</Text>
            <Text className="text-sm text-foreground">
              {formatCents(payout.grossCents)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">Fees</Text>
            <Text className="text-sm text-destructive">
              -{formatCents(payout.feeCents)}
            </Text>
          </View>
        </View>

        {payout.bankLast4 && (
          <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-border">
            <Building2 size={12} color="#666" />
            <Text className="text-xs text-muted-foreground">
              Bank ••{payout.bankLast4}
            </Text>
            {payout.arrivalDate && (
              <Text className="text-xs text-muted-foreground">
                • Arrives {formatDate(payout.arrivalDate)}
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
