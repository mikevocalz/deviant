/**
 * PromoteEventSheet — Bottom sheet for organizers to purchase event promotion.
 *
 * Shows placement options, duration pricing, and CTA to checkout via Stripe.
 * Uses @gorhom/bottom-sheet (same pattern as EventFilterSheet, CityPickerSheet).
 */

import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import {
  Zap,
  Eye,
  Layers,
  Check,
  Clock,
  CreditCard,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { usePromotionStore } from "@/lib/stores/promotion-store";
import { useEventCampaigns } from "@/lib/hooks/use-promotions";
import { promotionsApi } from "@/lib/api/promotions";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import { useQueryClient } from "@tanstack/react-query";
import { promotionKeys } from "@/lib/hooks/use-promotions";
import {
  PROMOTION_PRICING,
  type PromotionDuration,
  type CampaignPlacement,
} from "@/src/events/promotion-types";

const PLACEMENTS: {
  id: CampaignPlacement;
  label: string;
  description: string;
  icon: React.FC<any>;
}[] = [
  {
    id: "spotlight+feed",
    label: "Spotlight + Feed",
    description: "Maximum visibility in carousel and regular feed",
    icon: Layers,
  },
  {
    id: "spotlight",
    label: "Spotlight Only",
    description: "Featured in the top carousel",
    icon: Zap,
  },
  {
    id: "feed",
    label: "Feed Only",
    description: "Subtle promoted label in regular feed",
    icon: Eye,
  },
];

export function PromoteEventSheet() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const visible = usePromotionStore((s) => s.visible);
  const eventId = usePromotionStore((s) => s.eventId);
  const eventTitle = usePromotionStore((s) => s.eventTitle);
  const selectedDuration = usePromotionStore((s) => s.selectedDuration);
  const selectedPlacement = usePromotionStore((s) => s.selectedPlacement);
  const isCheckingOut = usePromotionStore((s) => s.isCheckingOut);
  const closeSheet = usePromotionStore((s) => s.closeSheet);
  const setDuration = usePromotionStore((s) => s.setDuration);
  const setPlacement = usePromotionStore((s) => s.setPlacement);
  const setCheckingOut = usePromotionStore((s) => s.setCheckingOut);

  const cityId = useEventsLocationStore((s) => s.activeCity?.id ?? null);

  // Fetch existing campaigns for status display
  const { data: campaigns = [] } = useEventCampaigns(eventId || "");
  const activeCampaign = campaigns.find(
    (c) => c.status === "active" || c.status === "pending",
  );

  // Open/close sheet based on store visibility
  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  const selectedPricing = PROMOTION_PRICING.find(
    (p) => p.duration === selectedDuration,
  );

  const handleCheckout = useCallback(async () => {
    if (!eventId || isCheckingOut) return;
    setCheckingOut(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await promotionsApi.createPromotionCheckout({
        eventId,
        cityId,
        duration: selectedDuration,
        placement: selectedPlacement,
        startNow: true,
      });

      if (result.error) {
        showToast("error", "Checkout Failed", result.error);
        return;
      }

      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url, {
          presentationStyle:
            Platform.OS === "ios"
              ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
              : undefined,
        });

        // After browser closes, invalidate promotion queries
        queryClient.invalidateQueries({ queryKey: promotionKeys.all });

        showToast(
          "success",
          "Promotion Created",
          `${eventTitle} is now being promoted!`,
        );
        closeSheet();
      }
    } catch (err: any) {
      console.error("[PromoteEventSheet] Checkout error:", err);
      showToast("error", "Error", err.message || "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }, [
    eventId,
    eventTitle,
    cityId,
    selectedDuration,
    selectedPlacement,
    isCheckingOut,
    setCheckingOut,
    showToast,
    closeSheet,
    queryClient,
  ]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["85%"]}
      onDismiss={handleDismiss}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#111" }}
      handleIndicatorStyle={{ backgroundColor: "#444" }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-12 h-12 rounded-2xl bg-amber-500/20 items-center justify-center mb-3">
            <Zap size={24} color="#f59e0b" fill="#f59e0b" />
          </View>
          <Text className="text-white text-xl font-bold">
            Promote to Spotlight
          </Text>
          <Text className="text-white/50 text-sm mt-1 text-center">
            Boost "{eventTitle}" with premium visibility
          </Text>
        </View>

        {/* Active campaign status */}
        {activeCampaign && (
          <View className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center gap-2 mb-1">
              <Check size={16} color="#22c55e" />
              <Text className="text-green-400 font-semibold text-sm">
                {activeCampaign.status === "active"
                  ? "Currently Promoted"
                  : "Promotion Pending"}
              </Text>
            </View>
            <Text className="text-white/50 text-xs">
              {activeCampaign.placement} • Ends{" "}
              {new Date(activeCampaign.ends_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}

        {/* Placement Selection */}
        <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">
          Placement
        </Text>
        <View className="gap-2 mb-6">
          {PLACEMENTS.map((p) => {
            const isSelected = selectedPlacement === p.id;
            const Icon = p.icon;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setPlacement(p.id);
                  Haptics.selectionAsync();
                }}
                className={`flex-row items-center p-4 rounded-2xl border ${
                  isSelected
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                    isSelected ? "bg-amber-500/20" : "bg-white/10"
                  }`}
                >
                  <Icon
                    size={18}
                    color={isSelected ? "#f59e0b" : "#888"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-semibold text-sm ${
                      isSelected ? "text-white" : "text-white/70"
                    }`}
                  >
                    {p.label}
                  </Text>
                  <Text className="text-white/40 text-xs mt-0.5">
                    {p.description}
                  </Text>
                </View>
                {isSelected && (
                  <View className="w-6 h-6 rounded-full bg-amber-500 items-center justify-center">
                    <Check size={14} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Duration Selection */}
        <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">
          Duration
        </Text>
        <View className="gap-2 mb-6">
          {PROMOTION_PRICING.map((tier) => {
            const isSelected = selectedDuration === tier.duration;
            return (
              <Pressable
                key={tier.duration}
                onPress={() => {
                  setDuration(tier.duration);
                  Haptics.selectionAsync();
                }}
                className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                  isSelected
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Clock
                    size={16}
                    color={isSelected ? "#f59e0b" : "#888"}
                  />
                  <View>
                    <Text
                      className={`font-semibold text-sm ${
                        isSelected ? "text-white" : "text-white/70"
                      }`}
                    >
                      {tier.label}
                    </Text>
                    <Text className="text-white/40 text-xs mt-0.5">
                      {tier.description}
                    </Text>
                  </View>
                </View>
                <Text
                  className={`font-bold text-base ${
                    isSelected ? "text-amber-400" : "text-white/60"
                  }`}
                >
                  {tier.price_display}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Summary + CTA */}
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-white/50 text-sm">Placement</Text>
            <Text className="text-white text-sm font-medium">
              {PLACEMENTS.find((p) => p.id === selectedPlacement)?.label}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-white/50 text-sm">Duration</Text>
            <Text className="text-white text-sm font-medium">
              {selectedPricing?.label}
            </Text>
          </View>
          <View className="h-px bg-white/10 my-2" />
          <View className="flex-row justify-between">
            <Text className="text-white font-bold text-base">Total</Text>
            <Text className="text-amber-400 font-bold text-base">
              {selectedPricing?.price_display}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleCheckout}
          disabled={isCheckingOut || !!activeCampaign}
          className={`flex-row items-center justify-center gap-2 py-4 rounded-2xl ${
            activeCampaign
              ? "bg-white/10"
              : isCheckingOut
                ? "bg-amber-500/50"
                : "bg-amber-500"
          }`}
        >
          {isCheckingOut ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CreditCard size={18} color="#fff" />
              <Text className="text-white font-bold text-base">
                {activeCampaign ? "Already Promoted" : "Boost Event"}
              </Text>
            </>
          )}
        </Pressable>

        <Text className="text-white/30 text-[11px] text-center mt-3">
          Payment is processed securely via Stripe. Promotion starts
          immediately after payment.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
