/**
 * Payment Methods Screen
 *
 * List, add, set default, and remove payment methods.
 * States: loading, empty, error, offline.
 */

import { useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Star,
  Trash2,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { paymentMethodsApi } from "@/lib/api/payments";
import { useUIStore } from "@/lib/stores/ui-store";
import type { PaymentMethod } from "@/lib/types/payments";

const BRAND_COLORS: Record<string, string> = {
  visa: "#1A1F71",
  mastercard: "#EB001B",
  amex: "#006FCF",
  discover: "#FF6000",
};

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  const {
    methods,
    isLoading,
    error,
    setMethods,
    setLoading,
    setError,
    removeMethod,
    setDefault,
  } = usePaymentsStore();

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await paymentMethodsApi.list();
      setMethods(result);
    } catch (err: any) {
      setError(err.message || "Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  }, [setMethods, setLoading, setError]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleSetDefault = useCallback(
    async (method: PaymentMethod) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDefault(method.id);
      const result = await paymentMethodsApi.setDefault(method.id);
      if (!result.success) {
        showToast("error", "Error", result.error || "Failed to set default");
        loadMethods();
      }
    },
    [setDefault, showToast, loadMethods],
  );

  const handleRemove = useCallback(
    (method: PaymentMethod) => {
      Alert.alert(
        "Remove Payment Method",
        `Remove ${BRAND_LABELS[method.card?.brand || ""] || "this card"} ending in ${method.card?.last4 || "****"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              removeMethod(method.id);
              const result = await paymentMethodsApi.remove(method.id);
              if (!result.success) {
                showToast("error", "Error", result.error || "Failed to remove");
                loadMethods();
              } else {
                showToast("success", "Removed", "Payment method removed");
              }
            },
          },
        ],
      );
    },
    [removeMethod, showToast, loadMethods],
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Payment Methods
        </Text>
        <Pressable
          onPress={() => {
            showToast("info", "Coming Soon", "Add payment method via Stripe Checkout");
          }}
          className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center"
          hitSlop={8}
        >
          <Plus size={20} color="#8A40CF" />
        </Pressable>
      </View>

      {/* Loading */}
      {isLoading && methods.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      )}

      {/* Error */}
      {error && !isLoading && (
        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-1 items-center justify-center px-8"
        >
          <AlertCircle size={48} color="rgba(239,68,68,0.4)" />
          <Text className="text-foreground font-sans-semibold mt-3">
            Failed to load
          </Text>
          <Text className="text-muted-foreground text-sm text-center mt-1">
            {error}
          </Text>
          <Pressable
            onPress={loadMethods}
            className="mt-4 bg-primary/10 rounded-xl px-5 py-2.5"
          >
            <Text className="text-primary font-sans-semibold">Retry</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Empty */}
      {!isLoading && !error && methods.length === 0 && (
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-1 items-center justify-center px-8"
        >
          <CreditCard size={56} color="rgba(255,255,255,0.1)" />
          <Text className="text-lg font-sans-semibold text-foreground mt-4">
            No payment methods
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Payment methods are added when you purchase tickets
          </Text>
        </Animated.View>
      )}

      {/* Methods List */}
      {methods.length > 0 && (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {methods.map((method, index) => (
            <Animated.View
              key={method.id}
              entering={FadeInDown.delay(index * 60).duration(300).springify().damping(18)}
            >
              <PaymentMethodCard
                method={method}
                onSetDefault={() => handleSetDefault(method)}
                onRemove={() => handleRemove(method)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PaymentMethodCard({
  method,
  onSetDefault,
  onRemove,
}: {
  method: PaymentMethod;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const brand = method.card?.brand || "card";
  const brandColor = BRAND_COLORS[brand] || "#666";
  const brandLabel = BRAND_LABELS[brand] || "Card";

  return (
    <View className="bg-card rounded-2xl border border-border mb-3 overflow-hidden">
      <View className="flex-row items-center p-4">
        {/* Card icon */}
        <View
          className="w-12 h-8 rounded-lg items-center justify-center mr-3"
          style={{ backgroundColor: `${brandColor}20` }}
        >
          <CreditCard size={18} color={brandColor} />
        </View>

        {/* Card info */}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[15px] font-sans-semibold text-foreground">
              {brandLabel} ••{method.card?.last4}
            </Text>
            {method.isDefault && (
              <View className="bg-primary/10 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-sans-bold text-primary">
                  DEFAULT
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Expires {method.card?.expMonth}/{method.card?.expYear}
            {method.card?.funding === "debit" ? " • Debit" : ""}
          </Text>
        </View>

        {/* Actions */}
        <View className="flex-row gap-2">
          {!method.isDefault && (
            <Pressable
              onPress={onSetDefault}
              className="w-9 h-9 rounded-xl bg-muted/50 items-center justify-center"
              hitSlop={8}
            >
              <Star size={16} color="#EAB308" />
            </Pressable>
          )}
          <Pressable
            onPress={onRemove}
            className="w-9 h-9 rounded-xl bg-destructive/10 items-center justify-center"
            hitSlop={8}
          >
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
