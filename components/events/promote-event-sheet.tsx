/**
 * PromoteEventSheet — Bottom sheet for organizers to purchase event promotion.
 *
 * Shows placement options, duration pricing, and CTA to checkout via Stripe.
 * Uses @gorhom/bottom-sheet (same pattern as EventFilterSheet, CityPickerSheet).
 */

import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { DVNTAnimatedVideoView } from "@/components/media/DVNTAnimatedVideoView";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
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
  Video,
  ImageIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import { GlassSheetBackground } from "@/components/sheets/glass-sheet-background";
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
  const eventImage = usePromotionStore((s) => s.eventImage);
  const flyerVideoUrl = usePromotionStore((s) => s.flyerVideoUrl);
  const flyerMediaType = usePromotionStore((s) => s.flyerMediaType);
  const closeSheet = usePromotionStore((s) => s.closeSheet);
  const setDuration = usePromotionStore((s) => s.setDuration);
  const setPlacement = usePromotionStore((s) => s.setPlacement);
  const setCheckingOut = usePromotionStore((s) => s.setCheckingOut);
  const setFlyerMediaType = usePromotionStore((s) => s.setFlyerMediaType);

  const cityId = useEventsLocationStore((s) => s.activeCity?.id ?? null);

  // Fetch existing campaigns for status display
  const { data: campaigns = [] } = useEventCampaigns(eventId || "");
  const activeCampaign = campaigns.find(
    (c) => c.status === "active" || c.status === "pending",
  );

  // Block re-purchase if campaign has > 24h remaining; allow extending if < 24h
  const campaignEndsAt = activeCampaign?.ends_at ? new Date(activeCampaign.ends_at) : null;
  const campaignHoursLeft = campaignEndsAt
    ? (campaignEndsAt.getTime() - Date.now()) / (1000 * 60 * 60)
    : null;
  const isExpiringSoon = campaignHoursLeft !== null && campaignHoursLeft < 24;
  const canExtend = !activeCampaign || isExpiringSoon;

  // Open/close sheet based on store visibility
  // Guard: if opening but campaign is still active and not expiring soon, close immediately
  const isPresentedRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (!canExtend) {
        // Already promoted with > 24h left — just close, don't show sheet
        closeSheet();
        showToast(
          "info",
          "Already Promoted",
          campaignHoursLeft != null
            ? `Active until ${campaignEndsAt!.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "This event is currently being promoted.",
        );
        return;
      }
      if (!isPresentedRef.current) {
        isPresentedRef.current = true;
        sheetRef.current?.present();
      }
    } else {
      isPresentedRef.current = false;
      sheetRef.current?.dismiss();
    }
  }, [visible, canExtend]);

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
        // openAuthSessionAsync auto-closes when Stripe redirects to dvnt:// deep link
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.url,
          "dvnt://",
          {
            showInRecents: false,
            preferEphemeralSession: true,
          },
        );

        // After browser closes (success or cancel), invalidate promotion queries
        queryClient.invalidateQueries({ queryKey: promotionKeys.all });

        const succeeded =
          browserResult.type === "success" &&
          browserResult.url?.includes("promoted=true");

        if (succeeded) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast(
            "success",
            "🚀 You're in the Spotlight",
            `${eventTitle} is live in ${
              selectedPlacement === "feed"
                ? "the feed"
                : selectedPlacement === "spotlight"
                  ? "the top carousel"
                  : "Spotlight + feed"
            } now.`,
          );
        } else {
          showToast("info", "Boost", "Payment flow closed.");
        }
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
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={{ backgroundColor: "#444" }}
      style={{ zIndex: 9999, elevation: 9999 }}
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

        {/* Cinematic flyer preview + Video-default / Image-secondary toggle */}
        {(flyerVideoUrl || eventImage) && (
          <Animated.View
            entering={FadeInDown.duration(360).springify().damping(18)}
            style={flyerStyles.container}
          >
            <View style={flyerStyles.preview}>
              {flyerMediaType === "video" && flyerVideoUrl ? (
                <DVNTAnimatedVideoView
                  uri={flyerVideoUrl}
                  width="100%"
                  height="100%"
                  contentFit="cover"
                  isPlaying
                  muted
                />
              ) : eventImage ? (
                <Image
                  source={{ uri: eventImage }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
              {/* Soft top gradient + "AD PREVIEW" pill */}
              <View pointerEvents="none" style={flyerStyles.previewGradient} />
              <View style={flyerStyles.previewBadge}>
                <Sparkles size={10} color="#f59e0b" fill="#f59e0b" />
                <Text style={flyerStyles.previewBadgeText}>AD PREVIEW</Text>
              </View>
            </View>

            {/* Toggle row — Video is the recommended default */}
            {(flyerVideoUrl || eventImage) && (
              <View style={flyerStyles.toggleRow}>
                <Pressable
                  onPress={() => {
                    if (!flyerVideoUrl) return;
                    Haptics.selectionAsync();
                    setFlyerMediaType("video");
                  }}
                  disabled={!flyerVideoUrl}
                  style={[
                    flyerStyles.toggleBtn,
                    flyerMediaType === "video" && flyerStyles.toggleBtnActive,
                    !flyerVideoUrl && { opacity: 0.4 },
                  ]}
                >
                  <Video
                    size={14}
                    color={flyerMediaType === "video" ? "#f59e0b" : "#888"}
                  />
                  <Text
                    style={[
                      flyerStyles.toggleText,
                      flyerMediaType === "video" && { color: "#f59e0b" },
                    ]}
                  >
                    Video
                  </Text>
                  {flyerVideoUrl && (
                    <View style={flyerStyles.recommendedDot}>
                      <Text style={flyerStyles.recommendedDotText}>•</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!eventImage) return;
                    Haptics.selectionAsync();
                    setFlyerMediaType("image");
                  }}
                  disabled={!eventImage}
                  style={[
                    flyerStyles.toggleBtn,
                    flyerMediaType === "image" && flyerStyles.toggleBtnActive,
                    !eventImage && { opacity: 0.4 },
                  ]}
                >
                  <ImageIcon
                    size={14}
                    color={flyerMediaType === "image" ? "#f59e0b" : "#888"}
                  />
                  <Text
                    style={[
                      flyerStyles.toggleText,
                      flyerMediaType === "image" && { color: "#f59e0b" },
                    ]}
                  >
                    Image
                  </Text>
                </Pressable>
              </View>
            )}

            {flyerMediaType === "video" && (
              <Text style={flyerStyles.helperText}>
                Video flyers convert {"~3×"} better than images
              </Text>
            )}
          </Animated.View>
        )}

        {/* WHERE YOUR EVENT WILL APPEAR */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(360).springify().damping(18)}
          className="mb-6"
        >
          <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">
            Where you'll appear
          </Text>
          <View style={whereStyles.row}>
            {/* Spotlight carousel preview */}
            <View
              style={[
                whereStyles.card,
                selectedPlacement !== "feed" && whereStyles.cardActive,
              ]}
            >
              <View style={whereStyles.spotlightStage}>
                <View
                  style={[
                    whereStyles.spotlightSlot,
                    whereStyles.spotlightSlotActive,
                  ]}
                >
                  <Zap size={10} color="#f59e0b" fill="#f59e0b" />
                </View>
                <View style={whereStyles.spotlightSlot} />
                <View style={whereStyles.spotlightSlot} />
              </View>
              <Text style={whereStyles.cardLabel}>Spotlight</Text>
              <Text style={whereStyles.cardSub}>Top of Events</Text>
            </View>

            {/* Feed card preview */}
            <View
              style={[
                whereStyles.card,
                selectedPlacement !== "spotlight" && whereStyles.cardActive,
              ]}
            >
              <View style={whereStyles.feedStage}>
                <View style={whereStyles.feedRow} />
                <View
                  style={[whereStyles.feedRow, whereStyles.feedRowPromoted]}
                >
                  <Sparkles size={9} color="#f59e0b" fill="#f59e0b" />
                </View>
                <View style={whereStyles.feedRow} />
              </View>
              <Text style={whereStyles.cardLabel}>Feed</Text>
              <Text style={whereStyles.cardSub}>Promoted card</Text>
            </View>
          </View>
          <View style={whereStyles.reach}>
            <TrendingUp size={12} color="#22c55e" />
            <Text style={whereStyles.reachText}>
              Estimated reach: {selectedPlacement === "spotlight+feed"
                ? "5,000+"
                : selectedPlacement === "spotlight"
                  ? "2,500+"
                  : "1,800+"} impressions
            </Text>
          </View>
        </Animated.View>

        {/* Active campaign status */}
        {activeCampaign && (
          <View
            className={`border rounded-2xl p-4 mb-6 ${
              isExpiringSoon
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-green-500/10 border-green-500/30"
            }`}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <Check size={16} color={isExpiringSoon ? "#f59e0b" : "#22c55e"} />
              <Text
                className={`font-semibold text-sm ${isExpiringSoon ? "text-amber-400" : "text-green-400"}`}
              >
                {isExpiringSoon
                  ? "Expiring Soon — Extend?"
                  : activeCampaign.status === "active"
                    ? "Currently Promoted"
                    : "Promotion Pending"}
              </Text>
            </View>
            <Text className="text-white/50 text-xs">
              {activeCampaign.placement} • Ends{" "}
              {campaignEndsAt?.toLocaleDateString("en-US", {
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
                  <Icon size={18} color={isSelected ? "#f59e0b" : "#888"} />
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
                  <Clock size={16} color={isSelected ? "#f59e0b" : "#888"} />
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
          disabled={isCheckingOut}
          className={`flex-row items-center justify-center gap-2 py-4 rounded-2xl ${
            isCheckingOut ? "bg-amber-500/50" : "bg-amber-500"
          }`}
        >
          {isCheckingOut ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CreditCard size={18} color="#fff" />
              <Text className="text-white font-bold text-base">
                {isExpiringSoon ? "Extend Promotion" : "Boost Event"}
              </Text>
            </>
          )}
        </Pressable>

        <Text className="text-white/30 text-[11px] text-center mt-3">
          Payment is processed securely via Stripe. Promotion starts immediately
          after payment.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const flyerStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  preview: {
    width: "100%",
    height: 220,
    backgroundColor: "#0a0a0a",
    position: "relative",
  },
  previewGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  previewBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: "rgba(245,158,11,0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    flex: 1,
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
  },
  toggleText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  recommendedDot: {
    marginLeft: 2,
  },
  recommendedDotText: {
    color: "#f59e0b",
    fontSize: 18,
    lineHeight: 14,
    fontWeight: "900",
  },
  helperText: {
    color: "rgba(245,158,11,0.7)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(245,158,11,0.06)",
  },
});

const whereStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    alignItems: "center",
    opacity: 0.5,
  },
  cardActive: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.4)",
    opacity: 1,
  },
  spotlightStage: {
    width: "100%",
    height: 52,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightSlot: {
    width: 32,
    height: 44,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightSlotActive: {
    backgroundColor: "rgba(245,158,11,0.25)",
    borderColor: "rgba(245,158,11,0.6)",
    borderWidth: 1.5,
  },
  feedStage: {
    width: "100%",
    height: 52,
    gap: 3,
    justifyContent: "center",
  },
  feedRow: {
    height: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
  },
  feedRowPromoted: {
    backgroundColor: "rgba(245,158,11,0.22)",
    borderColor: "rgba(245,158,11,0.55)",
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
  },
  cardLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cardSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: -4,
  },
  reach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reachText: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "700",
  },
});
