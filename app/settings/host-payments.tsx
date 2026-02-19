/**
 * Host / Organizer Payments Hub
 *
 * Dashboard for event organizers:
 * - Payouts overview (balance, pending, next payout)
 * - Payout history
 * - Transactions ledger
 * - Disputes / chargebacks
 * - Bank / verification status
 * - Branding (logo for receipts)
 */

import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeft,
  DollarSign,
  Banknote,
  BarChart3,
  AlertTriangle,
  Settings,
  Palette,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react-native";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { hostPayoutsApi, connectApi } from "@/lib/api/payments";
import type { PayoutSummary, ConnectAccount } from "@/lib/types/payments";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function HostPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    payoutSummary,
    payoutSummaryLoading,
    connectAccount,
    connectLoading,
    setPayoutSummary,
    setPayoutSummaryLoading,
    setConnectAccount,
    setConnectLoading,
  } = usePaymentsStore();

  const loadData = useCallback(async () => {
    setPayoutSummaryLoading(true);
    setConnectLoading(true);
    try {
      const [summary, account] = await Promise.all([
        hostPayoutsApi.getSummary(),
        connectApi.getStatus(),
      ]);
      setPayoutSummary(summary);
      setConnectAccount(account);
    } catch (err) {
      console.error("[HostPayments] loadData error:", err);
    } finally {
      setPayoutSummaryLoading(false);
      setConnectLoading(false);
    }
  }, [
    setPayoutSummary,
    setPayoutSummaryLoading,
    setConnectAccount,
    setConnectLoading,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isLoading = payoutSummaryLoading || connectLoading;
  const isConnected = connectAccount?.status === "active";

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Organizer Payments
        </Text>
      </View>

      {isLoading && !payoutSummary ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Balance Card */}
          {payoutSummary && (
            <Animated.View
              entering={FadeInDown.delay(50).duration(300).springify().damping(18)}
              className="mx-4 mt-2 bg-card rounded-2xl border border-border p-5"
            >
              <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Balance Overview
              </Text>

              <View className="flex-row gap-4">
                <BalanceItem
                  label="Available"
                  amount={payoutSummary.availableBalanceCents}
                  color="#22C55E"
                />
                <BalanceItem
                  label="Pending"
                  amount={payoutSummary.pendingBalanceCents}
                  color="#EAB308"
                />
                <BalanceItem
                  label="Total Paid"
                  amount={payoutSummary.totalPayoutsCents}
                  color="#3B82F6"
                />
              </View>

              {payoutSummary.nextPayoutEstimate && (
                <View className="flex-row items-center gap-2 mt-4 pt-3 border-t border-border">
                  <Clock size={14} color="#666" />
                  <Text className="text-xs text-muted-foreground">
                    Next payout: {payoutSummary.nextPayoutEstimate}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Connect Status */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300).springify().damping(18)}
            className="mx-4 mt-3"
          >
            <Pressable
              onPress={() =>
                router.push("/(protected)/events/organizer-setup" as any)
              }
              className="bg-card rounded-2xl border border-border p-4 flex-row items-center active:bg-secondary/50"
            >
              <View
                className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                  isConnected ? "bg-green-500/10" : "bg-orange-500/10"
                }`}
              >
                {isConnected ? (
                  <CheckCircle size={20} color="#22C55E" />
                ) : (
                  <AlertCircle size={20} color="#F97316" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-sans-semibold text-foreground">
                  {isConnected
                    ? "Stripe Connected"
                    : "Complete Stripe Setup"}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {isConnected
                    ? "Charges and payouts enabled"
                    : "Required to receive payouts"}
                </Text>
              </View>
              <ChevronRight size={18} color="#666" />
            </Pressable>
          </Animated.View>

          {/* Navigation Items */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(300).springify().damping(18)}
          >
            <SectionHeader title="Financial" />
            <NavRow
              icon={<Banknote size={20} color="#22C55E" />}
              label="Payout History"
              subtitle="View all payouts to your bank"
              onPress={() => router.push("/settings/host-payouts" as any)}
            />
            <Divider />
            <NavRow
              icon={<BarChart3 size={20} color="#3B82F6" />}
              label="Transactions"
              subtitle="Full ledger: fees, refunds, adjustments"
              onPress={() => router.push("/settings/host-transactions" as any)}
            />
            <Divider />
            <NavRow
              icon={<AlertTriangle size={20} color="#F97316" />}
              label="Disputes & Chargebacks"
              subtitle="Manage disputes and respond"
              onPress={() => router.push("/settings/host-disputes" as any)}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(300).springify().damping(18)}
          >
            <SectionHeader title="Settings" />
            <NavRow
              icon={<Settings size={20} color="#6B7280" />}
              label="Bank & Verification"
              subtitle="Manage your Stripe Connect account"
              onPress={() =>
                router.push("/(protected)/events/organizer-setup" as any)
              }
            />
            <Divider />
            <NavRow
              icon={<Palette size={20} color="#8A40CF" />}
              label="Receipt Branding"
              subtitle="Logo and branding for receipts & invoices"
              onPress={() => router.push("/settings/host-branding" as any)}
            />
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

function BalanceItem({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text
        className="text-lg font-sans-bold mt-0.5"
        style={{ color }}
      >
        {formatCents(amount)}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-5 pt-6 pb-2">
      <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </Text>
    </View>
  );
}

function NavRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-card px-5 py-3.5 active:bg-secondary/50"
    >
      <View className="w-10 h-10 rounded-xl bg-muted/50 items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-sans-semibold text-foreground">
          {label}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color="#666" />
    </Pressable>
  );
}

function Divider() {
  return <View className="ml-[68px] h-px bg-border" />;
}
