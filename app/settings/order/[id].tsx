/**
 * Order Detail Screen
 *
 * Shows complete purchase details:
 * - Payment summary with fees/taxes
 * - Money timeline (created → captured → receipt)
 * - Receipt PDF viewer + print button
 * - Ticket links
 * - Refund request entry point
 * - Support button
 *
 * States: loading, error, offline.
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
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeft,
  Receipt,
  Printer,
  Share2,
  RotateCcw,
  HelpCircle,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Ticket,
  ExternalLink,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { purchasesApi } from "@/lib/api/payments";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  PAYMENT_STATUS_CONFIG,
  type Order,
  type OrderTimelineEvent,
} from "@/lib/types/payments";
import {
  printHtml,
  shareHtmlAsPdf,
} from "@/lib/print/print-utils";
import { receiptPdfHtml } from "@/lib/print/thermal-templates";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  const {
    activeOrder,
    orderLoading,
    orderError,
    setActiveOrder,
    setOrderLoading,
    setOrderError,
  } = usePaymentsStore();

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setOrderLoading(true);
    setOrderError(null);
    try {
      const order = await purchasesApi.getOrder(id);
      setActiveOrder(order);
    } catch (err: any) {
      setOrderError(err.message || "Failed to load order");
    } finally {
      setOrderLoading(false);
    }
  }, [id, setActiveOrder, setOrderLoading, setOrderError]);

  useEffect(() => {
    loadOrder();
    return () => setActiveOrder(null);
  }, [loadOrder, setActiveOrder]);

  const handlePrintReceipt = useCallback(async () => {
    if (!activeOrder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const html = receiptPdfHtml({ order: activeOrder });
    const result = await printHtml(html);
    if (!result.success) {
      showToast("error", "Print Failed", result.error || "Unable to print");
    }
  }, [activeOrder, showToast]);

  const handleShareReceipt = useCallback(async () => {
    if (!activeOrder) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const html = receiptPdfHtml({ order: activeOrder });
    const result = await shareHtmlAsPdf(html);
    if (!result.success) {
      showToast("error", "Share Failed", result.error || "Unable to share");
    }
  }, [activeOrder, showToast]);

  // Loading
  if (orderLoading && !activeOrder) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator color="#8A40CF" size="large" />
      </View>
    );
  }

  // Error
  if (orderError && !activeOrder) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center px-4 py-3 gap-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Text className="text-lg font-sans-bold text-foreground">Order</Text>
        </View>
        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-1 items-center justify-center px-8"
        >
          <AlertCircle size={48} color="rgba(239,68,68,0.4)" />
          <Text className="text-foreground font-sans-semibold mt-3">
            Failed to load order
          </Text>
          <Pressable
            onPress={loadOrder}
            className="mt-4 bg-primary/10 rounded-xl px-5 py-2.5"
          >
            <Text className="text-primary font-sans-semibold">Retry</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (!activeOrder) return null;

  const statusConfig =
    PAYMENT_STATUS_CONFIG[activeOrder.status] || PAYMENT_STATUS_CONFIG.pending;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Order Details
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + Event Card */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300).springify().damping(18)}
          className="mx-4 mt-2 bg-card rounded-2xl border border-border p-4"
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-sans-bold text-foreground">
              {formatCents(activeOrder.fees.totalCents)}
            </Text>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: statusConfig.bg }}
            >
              <Text
                className="text-xs font-sans-bold"
                style={{ color: statusConfig.text }}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {activeOrder.event && (
            <Pressable
              onPress={() =>
                router.push(
                  `/(protected)/events/${activeOrder.event!.id}` as any,
                )
              }
              className="flex-row items-center bg-muted/30 rounded-xl p-3 mt-1"
            >
              <View className="flex-1">
                <Text
                  className="text-sm font-sans-semibold text-foreground"
                  numberOfLines={1}
                >
                  {activeOrder.event.title}
                </Text>
                {activeOrder.event.startDate && (
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(activeOrder.event.startDate)}
                  </Text>
                )}
              </View>
              <ChevronRight size={16} color="#666" />
            </Pressable>
          )}

          <Text className="text-xs text-muted-foreground mt-3">
            Order #{activeOrder.id.slice(0, 8).toUpperCase()} •{" "}
            {formatDate(activeOrder.createdAt)}
          </Text>
        </Animated.View>

        {/* Fees Breakdown */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300).springify().damping(18)}
          className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4"
        >
          <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Payment Summary
          </Text>

          <FeeRow label="Subtotal" amount={activeOrder.fees.subtotalCents} />
          {activeOrder.fees.platformFeeCents > 0 && (
            <FeeRow
              label="Service Fee"
              amount={activeOrder.fees.platformFeeCents}
            />
          )}
          {activeOrder.fees.processingFeeCents > 0 && (
            <FeeRow
              label="Processing"
              amount={activeOrder.fees.processingFeeCents}
            />
          )}
          {activeOrder.fees.taxCents > 0 && (
            <FeeRow label="Tax" amount={activeOrder.fees.taxCents} />
          )}

          <View className="h-px bg-border my-2" />

          <View className="flex-row items-center justify-between">
            <Text className="text-base font-sans-bold text-foreground">
              Total
            </Text>
            <Text className="text-base font-sans-bold text-foreground">
              {formatCents(activeOrder.fees.totalCents)}
            </Text>
          </View>

          {activeOrder.paymentMethodBrand && (
            <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
              <CreditCard size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                {activeOrder.paymentMethodBrand} ••
                {activeOrder.paymentMethodLast4}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Timeline */}
        {activeOrder.timeline && activeOrder.timeline.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(300).springify().damping(18)}
            className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4"
          >
            <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Timeline
            </Text>
            {activeOrder.timeline.map((event, i) => (
              <TimelineItem
                key={`${event.type}-${i}`}
                event={event}
                isLast={i === activeOrder.timeline.length - 1}
              />
            ))}
          </Animated.View>
        )}

        {/* Tickets */}
        {activeOrder.tickets && activeOrder.tickets.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(300).springify().damping(18)}
            className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4"
          >
            <Text className="text-xs font-sans-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Tickets
            </Text>
            {activeOrder.tickets.map((ticket) => (
              <Pressable
                key={ticket.id}
                onPress={() =>
                  router.push(
                    `/(protected)/ticket/${activeOrder.event?.id}` as any,
                  )
                }
                className="flex-row items-center py-2"
              >
                <Ticket size={16} color="#8A40CF" />
                <Text className="flex-1 text-sm text-foreground ml-2">
                  {ticket.ticketTypeName}
                </Text>
                <ChevronRight size={14} color="#666" />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(300).springify().damping(18)}
          className="mx-4 mt-3 gap-2"
        >
          {/* Receipt / Print / Share */}
          <View className="flex-row gap-2">
            <ActionButton
              icon={<Printer size={18} color="#fff" />}
              label="Print"
              onPress={handlePrintReceipt}
              className="flex-1"
            />
            <ActionButton
              icon={<Share2 size={18} color="#fff" />}
              label="Share"
              onPress={handleShareReceipt}
              className="flex-1"
            />
            <ActionButton
              icon={<Receipt size={18} color="#fff" />}
              label="Receipt"
              onPress={() =>
                router.push(
                  `/settings/receipt-viewer?orderId=${activeOrder.id}&type=receipt` as any,
                )
              }
              className="flex-1"
            />
          </View>

          {/* Refund + Support */}
          {activeOrder.status === "paid" && (
            <ActionButton
              icon={<RotateCcw size={18} color="#F97316" />}
              label="Request Refund"
              onPress={() =>
                router.push(
                  `/settings/refund-request?orderId=${activeOrder.id}` as any,
                )
              }
              variant="outline"
            />
          )}

          <ActionButton
            icon={<HelpCircle size={18} color="#6B7280" />}
            label="Get Help with This Order"
            onPress={() => router.push("/settings/faq" as any)}
            variant="outline"
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FeeRow({ label, amount }: { label: string; amount: number }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground">{formatCents(amount)}</Text>
    </View>
  );
}

function TimelineItem({
  event,
  isLast,
}: {
  event: OrderTimelineEvent;
  isLast: boolean;
}) {
  const iconColor =
    event.type === "refund_processed" || event.type === "dispute_opened"
      ? "#F97316"
      : "#22C55E";

  return (
    <View className="flex-row">
      {/* Dot + line */}
      <View className="items-center mr-3">
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          {event.type.includes("refund") || event.type.includes("dispute") ? (
            <AlertCircle size={12} color={iconColor} />
          ) : (
            <CheckCircle size={12} color={iconColor} />
          )}
        </View>
        {!isLast && (
          <View className="w-px flex-1 bg-border my-1" style={{ minHeight: 16 }} />
        )}
      </View>

      {/* Content */}
      <View className="flex-1 pb-3">
        <Text className="text-sm font-sans-semibold text-foreground">
          {event.label}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {formatDate(event.timestamp)}
        </Text>
        {event.detail && (
          <Text className="text-xs text-muted-foreground mt-0.5">
            {event.detail}
          </Text>
        )}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  variant = "default",
  className: extraClass = "",
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: "default" | "outline";
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 py-3.5 rounded-2xl ${
        variant === "outline"
          ? "bg-card border border-border"
          : "bg-muted/50"
      } active:opacity-70 ${extraClass}`}
    >
      {icon}
      <Text
        className={`text-sm font-sans-semibold ${
          variant === "outline" ? "text-foreground" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
