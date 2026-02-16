/**
 * Organizer Setup Screen
 *
 * Guides organizers through Stripe Connect Express onboarding.
 * Opens Stripe's hosted onboarding page via expo-web-browser.
 * Polls for account status after return.
 */

import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  DollarSign,
  Shield,
  Banknote,
} from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { organizerApi } from "@/lib/api/organizer";
import { useUIStore } from "@/lib/stores/ui-store";
import { FeatureGate } from "@/lib/feature-flags";

type AccountStatus = {
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

function OrganizerSetupContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  const [status, setStatus] = useState<AccountStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    const result = await organizerApi.getStatus();
    setStatus(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleStartOnboarding = useCallback(async () => {
    setIsOnboarding(true);
    try {
      const result = await organizerApi.startOnboarding();
      if (result.error) {
        showToast("error", "Error", result.error);
        return;
      }
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url, {
          presentationStyle:
            Platform.OS === "ios"
              ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
              : undefined,
        });
        // Re-check status after browser closes
        await checkStatus();
      }
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to start onboarding");
    } finally {
      setIsOnboarding(false);
    }
  }, [checkStatus, showToast]);

  const isFullyConnected =
    status.connected && status.charges_enabled && status.payouts_enabled;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-sans-bold text-foreground flex-1">
          Organizer Setup
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8A40CF" size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          entering={FadeIn.duration(300)}
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Status Card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300).springify().damping(18)}
            className="bg-card rounded-2xl border border-border p-5 mt-4"
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  isFullyConnected ? "bg-green-500/15" : "bg-primary/10"
                }`}
              >
                {isFullyConnected ? (
                  <CheckCircle size={24} color="#22C55E" />
                ) : (
                  <CreditCard size={24} color="#8A40CF" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-sans-bold text-foreground">
                  {isFullyConnected
                    ? "Payouts Active"
                    : status.connected
                      ? "Setup Incomplete"
                      : "Connect Your Bank"}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {isFullyConnected
                    ? "You can receive ticket revenue"
                    : "Required to sell paid tickets"}
                </Text>
              </View>
            </View>

            {/* Status checklist */}
            <View className="gap-2.5 mb-5">
              <StatusRow
                label="Account created"
                done={status.connected}
              />
              <StatusRow
                label="Details submitted"
                done={!!status.details_submitted}
              />
              <StatusRow
                label="Charges enabled"
                done={!!status.charges_enabled}
              />
              <StatusRow
                label="Payouts enabled"
                done={!!status.payouts_enabled}
              />
            </View>

            {!isFullyConnected && (
              <Pressable
                onPress={handleStartOnboarding}
                disabled={isOnboarding}
                className="bg-primary rounded-full py-3.5 flex-row items-center justify-center gap-2"
                style={{ opacity: isOnboarding ? 0.6 : 1 }}
              >
                {isOnboarding ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <ExternalLink size={18} color="#000" />
                    <Text className="text-base font-sans-bold text-primary-foreground">
                      {status.connected
                        ? "Continue Setup"
                        : "Connect with Stripe"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>

          {/* Info cards */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(300).springify().damping(18)}
            className="mt-5 gap-3"
          >
            <InfoCard
              icon={<DollarSign size={18} color="#22C55E" />}
              title="Revenue"
              description="Receive ticket sales minus platform fee (5% + $1/ticket) and Stripe processing."
            />
            <InfoCard
              icon={<Banknote size={18} color="#3B82F6" />}
              title="Payouts"
              description="Funds released 5 business days after event ends. Transferred directly to your bank."
            />
            <InfoCard
              icon={<Shield size={18} color="#8A40CF" />}
              title="Security"
              description="Powered by Stripe Connect. Your banking info is never stored on our servers."
            />
          </Animated.View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      {done ? (
        <CheckCircle size={16} color="#22C55E" />
      ) : (
        <AlertCircle size={16} color="#6B7280" />
      )}
      <Text
        className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View className="bg-card/50 rounded-xl border border-border/50 p-4 flex-row gap-3">
      <View className="mt-0.5">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-foreground">
          {title}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5 leading-4">
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function OrganizerSetupScreen() {
  return (
    <FeatureGate
      flag="organizer_tools_enabled"
      fallback={
        <View className="flex-1 bg-background items-center justify-center">
          <Text className="text-muted-foreground">
            Organizer tools coming soon
          </Text>
        </View>
      }
    >
      <OrganizerSetupContent />
    </FeatureGate>
  );
}
