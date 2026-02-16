/**
 * Sneaky Link Paywall Modal
 *
 * Shown when joining a session that has >= 10 active participants.
 * Host never pays. iOS uses external purchase link (US compliant).
 * Android/Web uses Stripe Checkout via expo-web-browser.
 *
 * Does NOT modify the Sneaky Link chat screen or cards.
 */

import { View, Text, Pressable, Platform, ActivityIndicator } from "react-native";
import { useState, useCallback } from "react";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";
import { Lock, ExternalLink, X, Shield } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { isFeatureEnabled } from "@/lib/feature-flags";

interface SneakyPaywallModalProps {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
  onAccessGranted: () => void;
}

export function SneakyPaywallModal({
  visible,
  sessionId,
  onClose,
  onAccessGranted,
}: SneakyPaywallModalProps) {
  const authUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (!authUser?.id || !sessionId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "sneaky-access-checkout",
        {
          body: {
            session_id: sessionId,
            user_id: authUser.id,
          },
        },
      );

      if (error) throw error;

      if (data?.url) {
        // Open Stripe Checkout in browser
        const result = await WebBrowser.openBrowserAsync(data.url, {
          presentationStyle:
            Platform.OS === "ios"
              ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
              : undefined,
        });

        // After browser closes, check if access was granted
        if (result.type === "cancel" || result.type === "dismiss") {
          // Check if webhook already processed
          const { data: access } = await supabase
            .from("sneaky_access")
            .select("session_id")
            .eq("session_id", sessionId)
            .eq("user_id", authUser.id)
            .single();

          if (access) {
            onAccessGranted();
          }
        }
      }
    } catch (err: any) {
      console.error("[SneakyPaywall] Error:", err);
      showToast("error", "Error", err.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id, sessionId, onAccessGranted, showToast]);

  if (!visible || !isFeatureEnabled("sneaky_paywall_enabled")) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <Pressable className="flex-1" onPress={onClose} />

      <Animated.View
        entering={FadeInUp.duration(300).springify().damping(18)}
        className="bg-card rounded-t-3xl px-6 pt-6 pb-10"
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
        <View className="items-center mb-4">
          <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
            <Lock size={28} color="#8A40CF" />
          </View>
        </View>

        {/* Title */}
        <Text className="text-xl font-sans-bold text-foreground text-center mb-2">
          Room is Full
        </Text>

        {/* Description */}
        <Text className="text-sm text-muted-foreground text-center mb-6 px-4">
          This room has reached the free limit of 10 participants. Unlock access
          for a one-time fee.
        </Text>

        {/* Price */}
        <View className="bg-muted rounded-2xl p-4 mb-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-sans-semibold text-foreground">
              Unlock Access
            </Text>
            <Text className="text-xl font-sans-bold text-primary">$2.99</Text>
          </View>
          <Text className="text-xs text-muted-foreground mt-1">
            One-time payment • Instant access
          </Text>
        </View>

        {/* Purchase button */}
        <Pressable
          onPress={handlePurchase}
          disabled={isLoading}
          className="bg-primary rounded-full py-4 flex-row items-center justify-center gap-2 mb-3"
          style={{ opacity: isLoading ? 0.6 : 1 }}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <ExternalLink size={18} color="#000" />
              <Text className="text-base font-sans-bold text-primary-foreground">
                {Platform.OS === "ios"
                  ? "Continue to Payment"
                  : "Pay $2.99"}
              </Text>
            </>
          )}
        </Pressable>

        {/* Not now */}
        <Pressable onPress={onClose} className="py-3 items-center">
          <Text className="text-sm text-muted-foreground">Not now</Text>
        </Pressable>

        {/* iOS compliance text */}
        {Platform.OS === "ios" && (
          <View className="flex-row items-center justify-center gap-1 mt-2">
            <Shield size={10} color="#666" />
            <Text className="text-[10px] text-muted-foreground text-center">
              Payment processed securely on our website
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}
