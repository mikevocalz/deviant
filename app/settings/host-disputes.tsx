/**
 * Host Disputes & Chargebacks Screen
 *
 * Lists disputes/chargebacks with status, amounts, deadlines.
 * Shows action-required badges and evidence submission deadlines.
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
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle,
  XCircle,
} from "lucide-react-native";
import { LegendList } from "@/components/list";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { hostDisputesApi } from "@/lib/api/payments";
import type { Dispute } from "@/lib/types/payments";

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

const DISPUTE_STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  needs_response: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#EF4444",
    label: "Needs Response",
  },
  warning_needs_response: {
    bg: "rgba(249, 115, 22, 0.15)",
    text: "#F97316",
    label: "Warning",
  },
  under_review: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#3B82F6",
    label: "Under Review",
  },
  warning_under_review: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#3B82F6",
    label: "Under Review",
  },
  won: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#22C55E",
    label: "Won",
  },
  lost: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#EF4444",
    label: "Lost",
  },
  charge_refunded: {
    bg: "rgba(168, 85, 247, 0.15)",
    text: "#A855F7",
    label: "Refunded",
  },
  warning_closed: {
    bg: "rgba(107, 114, 128, 0.15)",
    text: "#6B7280",
    label: "Closed",
  },
};

export default function HostDisputesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    refunds: disputes,
    refundsLoading: disputesLoading,
    setRefunds: setDisputes,
    setRefundsLoading: setDisputesLoading,
  } = usePaymentsStore();

  // Re-use refunds slice for disputes (same shape)
  const disputesList = usePaymentsStore((s) => s.refunds) as unknown as Dispute[];

  const loadDisputes = useCallback(async () => {
    setDisputesLoading(true);
    try {
      const result = await hostDisputesApi.list();
      setDisputes(result.data as any);
    } catch (err) {
      console.error("[HostDisputes] load error:", err);
    } finally {
      setDisputesLoading(false);
    }
  }, [setDisputes, setDisputesLoading]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Disputes & Chargebacks
        </Text>
      </View>

      {disputesLoading && disputesList.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      )}

      {!disputesLoading && disputesList.length === 0 && (
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-1 items-center justify-center px-8"
        >
          <ShieldAlert size={56} color="rgba(255,255,255,0.1)" />
          <Text className="text-lg font-sans-semibold text-foreground mt-4">
            No disputes
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Great news! You have no disputes or chargebacks.
          </Text>
        </Animated.View>
      )}

      {disputesList.length > 0 && (
        <LegendList
          data={disputesList}
          keyExtractor={(item: Dispute) => item.id}
          renderItem={({ item, index }: { item: Dispute; index: number }) => (
            <DisputeCard dispute={item} index={index} />
          )}
          estimatedItemSize={110}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 20,
          }}
          onRefresh={loadDisputes}
          refreshing={disputesLoading}
        />
      )}
    </View>
  );
}

function DisputeCard({
  dispute,
  index,
}: {
  dispute: Dispute;
  index: number;
}) {
  const statusConfig =
    DISPUTE_STATUS_CONFIG[dispute.status] || DISPUTE_STATUS_CONFIG.under_review;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300).springify().damping(18)}
    >
      <View className="mx-4 mb-3 bg-card rounded-2xl border border-border p-4">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-[15px] font-sans-semibold text-foreground">
              {formatCents(dispute.amountCents)} dispute
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {dispute.reason}
            </Text>
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

        {dispute.actionRequired && (
          <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl p-3 mt-1">
            <AlertTriangle size={14} color="#EF4444" />
            <Text className="text-xs text-destructive font-sans-semibold flex-1">
              {dispute.actionDescription || "Response required"}
            </Text>
            {dispute.evidenceDueBy && (
              <Text className="text-[10px] text-destructive">
                Due {formatDate(dispute.evidenceDueBy)}
              </Text>
            )}
          </View>
        )}

        <View className="flex-row items-center gap-3 mt-2 pt-2 border-t border-border">
          <Clock size={12} color="#666" />
          <Text className="text-xs text-muted-foreground">
            Opened {formatDate(dispute.createdAt)}
          </Text>
          {dispute.resolvedAt && (
            <Text className="text-xs text-muted-foreground">
              • Resolved {formatDate(dispute.resolvedAt)}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
