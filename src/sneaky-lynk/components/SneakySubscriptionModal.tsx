/**
 * Sneaky Lynk Subscription Modal
 *
 * Shown when a host tries to create a room that exceeds their current plan.
 * Presents Free / Host 25 / Host 50 tiers and initiates Stripe Billing checkout.
 *
 * Replaces the one-time $2.99 SneakyPaywallModal for the HOST upgrade flow.
 */

import {
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useState, useCallback } from "react";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";
import {
  Zap,
  X,
  Shield,
  Check,
  Users,
  Crown,
  ChevronRight,
} from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { requireBetterAuthToken } from "@/lib/auth/identity";

interface Plan {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  maxParticipants: number;
  durationLabel: string;
  highlight: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceNote: "forever",
    maxParticipants: 7,
    durationLabel: "5 min / session",
    highlight: false,
    features: [
      "Up to 7 people per room",
      "5 minute session limit",
      "2 sessions per day",
    ],
  },
  {
    id: "host_25",
    name: "Host 25",
    price: "$14.99",
    priceNote: "/ month",
    maxParticipants: 25,
    durationLabel: "Unlimited duration",
    highlight: true,
    features: [
      "Up to 25 participants",
      "Unlimited duration",
      "Priority support",
    ],
  },
  {
    id: "host_50",
    name: "Host 50",
    price: "$24.99",
    priceNote: "/ month",
    maxParticipants: 50,
    durationLabel: "Unlimited duration",
    highlight: false,
    features: [
      "Up to 50 participants",
      "Unlimited duration",
      "Priority support",
      "Analytics dashboard (soon)",
    ],
  },
];

interface SneakySubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  currentPlan?: string;
  reason?: "participant_limit" | "duration_limit" | "upgrade";
}

export function SneakySubscriptionModal({
  visible,
  onClose,
  currentPlan = "free",
  reason = "upgrade",
}: SneakySubscriptionModalProps) {
  const authUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("host_25");

  const handleSubscribe = useCallback(
    async (planId: string) => {
      if (!authUser?.id || planId === "free") return;
      setLoadingPlanId(planId);

      try {
        const token = await requireBetterAuthToken();
        const { data, error } = await supabase.functions.invoke(
          "sneaky-billing-checkout",
          {
            body: { plan_id: planId },
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (error) throw error;

        // Server says user should change plans via billing portal
        if (data?.redirect === "billing_portal") {
          showToast(
            "info",
            "Change Plan",
            "Use the billing portal to change your plan.",
          );
          onClose();
          return;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.url) {
          const result = await WebBrowser.openBrowserAsync(data.url, {
            presentationStyle:
              Platform.OS === "ios"
                ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
                : undefined,
          });

          if (result.type === "cancel" || result.type === "dismiss") {
            const { data: sub } = await supabase
              .from("sneaky_subscriptions")
              .select("status, plan_id")
              .eq("host_id", authUser.id)
              .single();

            if (sub?.status === "active" || sub?.status === "trialing") {
              showToast(
                "success",
                "Subscribed!",
                `You are now on the ${PLANS.find((p) => p.id === sub.plan_id)?.name} plan.`,
              );
              onClose();
            }
          }
        }
      } catch (err: any) {
        console.error("[SneakySubscriptionModal] Error:", err);
        if (
          err?.message?.includes("Already subscribed") ||
          err?.message?.includes("billing portal")
        ) {
          showToast(
            "info",
            "Already Subscribed",
            "Manage your plan in billing settings.",
          );
        } else {
          showToast("error", "Error", err.message || "Subscription failed");
        }
      } finally {
        setLoadingPlanId(null);
      }
    },
    [authUser?.id, onClose, showToast],
  );

  if (!visible) return null;

  const reasonText = {
    participant_limit: "Your current plan has reached its participant limit.",
    duration_limit:
      "Your session has reached its time limit for the free plan.",
    upgrade: "Upgrade to host bigger, longer sessions.",
  }[reason];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <Pressable className="flex-1" onPress={onClose} />

      <Animated.View
        entering={FadeInUp.duration(300).springify().damping(18)}
        className="bg-card rounded-t-3xl px-5 pt-6 pb-10"
        style={{ maxHeight: "85%" }}
      >
        {/* Close */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          className="absolute top-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-muted"
        >
          <X size={16} color="#999" />
        </Pressable>

        {/* Icon */}
        <View className="items-center mb-3">
          <View
            className="w-14 h-14 rounded-full items-center justify-center"
            style={{ backgroundColor: "#8A40CF20" }}
          >
            <Crown size={26} color="#8A40CF" />
          </View>
        </View>

        {/* Title + sub */}
        <Text className="text-xl font-sans-bold text-foreground text-center mb-1">
          Upgrade Your Plan
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-5 px-4">
          {reasonText}
        </Text>

        {/* Plan cards */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        >
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isSelected = plan.id === selectedPlan;
            const isLoading = loadingPlanId === plan.id;
            const isFree = plan.id === "free";

            return (
              <Pressable
                key={plan.id}
                onPress={() => !isCurrentPlan && setSelectedPlan(plan.id)}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor:
                    isSelected && !isFree
                      ? "#8A40CF18"
                      : "rgba(255,255,255,0.04)",
                  borderWidth: 1.5,
                  borderColor:
                    isSelected && !isFree
                      ? "#8A40CF"
                      : isCurrentPlan
                        ? "#22c55e40"
                        : "rgba(255,255,255,0.08)",
                }}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Users
                      size={16}
                      color={plan.highlight ? "#8A40CF" : "#888"}
                    />
                    <Text className="text-base font-sans-bold text-foreground">
                      {plan.name}
                    </Text>
                    {plan.highlight && (
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#8A40CF" }}
                      >
                        <Text className="text-[10px] font-sans-bold text-white">
                          POPULAR
                        </Text>
                      </View>
                    )}
                    {isCurrentPlan && (
                      <View className="px-2 py-0.5 rounded-full bg-green-500/20">
                        <Text className="text-[10px] font-sans-bold text-green-500">
                          CURRENT
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-sans-bold text-foreground">
                      {plan.price}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {plan.priceNote}
                    </Text>
                  </View>
                </View>

                <View className="gap-1">
                  {plan.features.map((f) => (
                    <View key={f} className="flex-row items-center gap-2">
                      <Check size={12} color="#22c55e" />
                      <Text className="text-xs text-muted-foreground">{f}</Text>
                    </View>
                  ))}
                </View>

                {!isFree && !isCurrentPlan && isSelected && (
                  <Pressable
                    onPress={() => handleSubscribe(plan.id)}
                    disabled={!!loadingPlanId}
                    className="mt-3 rounded-xl py-3 flex-row items-center justify-center gap-2"
                    style={{
                      backgroundColor: "#8A40CF",
                      opacity: loadingPlanId ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Zap size={15} color="#fff" />
                        <Text className="text-sm font-sans-bold text-white">
                          {Platform.OS === "ios"
                            ? "Continue to Payment"
                            : `Subscribe · ${plan.price}/mo`}
                        </Text>
                        <ChevronRight size={14} color="#fff" />
                      </>
                    )}
                  </Pressable>
                )}
              </Pressable>
            );
          })}

          {/* iOS compliance */}
          {Platform.OS === "ios" && (
            <View className="flex-row items-center justify-center gap-1 mt-1">
              <Shield size={10} color="#666" />
              <Text className="text-[10px] text-muted-foreground text-center">
                Payment processed securely via our website
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
