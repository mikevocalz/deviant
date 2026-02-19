/**
 * Ticket Scanner Screen — VisionCamera QR Code Scanner
 *
 * Organizer scans tickets at the door using the device camera.
 * Uses react-native-vision-camera for high-perf scanning.
 * Falls back gracefully if VisionCamera is unavailable.
 */

import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  ArrowLeft,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  ZapOff,
  RotateCcw,
} from "lucide-react-native";
import { useScanTicket } from "@/lib/hooks/use-tickets";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useOfflineCheckinStore } from "@/lib/stores/offline-checkin-store";
import { FeatureGate } from "@/lib/feature-flags";
import * as Haptics from "expo-haptics";

// Lazy-load VisionCamera to prevent crashes if not installed
let Camera: any = null;
let useCameraDevice: any = null;
let useCodeScanner: any = null;
let useCameraPermission: any = null;

try {
  const vc = require("react-native-vision-camera");
  Camera = vc.Camera;
  useCameraDevice = vc.useCameraDevice;
  useCodeScanner = vc.useCodeScanner;
  useCameraPermission = vc.useCameraPermission;
} catch {
  // VisionCamera not available
}

type ScanResult = {
  type: "success" | "error" | "already_scanned" | "not_found";
  name?: string;
  tierName?: string;
  message?: string;
};

type ScanHistoryEntry = {
  id: string;
  type: ScanResult["type"];
  name?: string;
  tierName?: string;
  timestamp: number;
};

function ScanResultOverlay({
  result,
  onDismiss,
}: {
  result: ScanResult;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(0.8);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.05, { duration: 150 }),
      withTiming(1, { duration: 100 }),
    );
  }, []);

  const isSuccess = result.type === "success";
  const bgColor = isSuccess
    ? "rgba(34, 197, 94, 0.95)"
    : "rgba(239, 68, 68, 0.95)";
  const Icon = isSuccess
    ? CheckCircle2
    : result.type === "already_scanned"
      ? AlertTriangle
      : XCircle;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={onDismiss}
        style={{ flex: 1, justifyContent: "center" }}
      >
        <Animated.View
          style={[
            {
              backgroundColor: bgColor,
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
              marginHorizontal: 40,
              gap: 12,
            },
            animatedStyle,
          ]}
        >
          <Icon size={56} color="#fff" strokeWidth={2} />
          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {isSuccess
              ? "Checked In!"
              : result.type === "already_scanned"
                ? "Already Scanned"
                : result.type === "not_found"
                  ? "Invalid Ticket"
                  : "Scan Error"}
          </Text>
          {result.name && (
            <Text
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 16,
                fontWeight: "500",
              }}
            >
              {result.name}
            </Text>
          )}
          {result.tierName && (
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
              {result.tierName}
            </Text>
          )}
          {result.message && (
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {result.message}
            </Text>
          )}
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Tap anywhere to scan next
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function ScannerContent({ eventId }: { eventId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const scanMutation = useScanTicket();
  const offlineStore = useOfflineCheckinStore();
  const hasOfflineData = offlineStore.hasOfflineData(eventId);

  const [torchOn, setTorchOn] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef(false);

  // VisionCamera setup
  const hasVisionCamera = Camera != null && useCameraDevice != null;
  const device = hasVisionCamera ? useCameraDevice("back") : null;
  const permission = hasVisionCamera
    ? useCameraPermission()
    : { hasPermission: false, requestPermission: async () => {} };

  useEffect(() => {
    if (hasVisionCamera && !permission.hasPermission) {
      permission.requestPermission();
    }
  }, [hasVisionCamera]);

  const handleCodeScanned = useCallback(
    (codes: any[]) => {
      if (cooldownRef.current || scanResult) return;
      const code = codes[0];
      if (!code?.value) return;

      const qrValue = code.value;

      // Prevent re-scanning same code rapidly
      if (qrValue === lastScannedRef.current) return;
      lastScannedRef.current = qrValue;
      cooldownRef.current = true;

      // Extract qr_token from value (could be raw token or dvnt://ticket/{token})
      let qrToken = qrValue;
      const deepLinkMatch = qrValue.match(/dvnt:\/\/ticket\/(.+)/);
      if (deepLinkMatch) {
        qrToken = deepLinkMatch[1];
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      scanMutation.mutate(
        { qrToken, scannedBy: authUser?.id, eventId },
        {
          onSuccess: (data) => {
            if (data.valid) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const entry: ScanHistoryEntry = {
                id: `${Date.now()}`,
                type: "success",
                name: data.ticket?.name,
                tierName: data.ticket?.tier_name,
                timestamp: Date.now(),
              };
              setScanResult({
                type: "success",
                name: data.ticket?.name,
                tierName: data.ticket?.tier_name,
              });
              setScanCount((c) => c + 1);
              setScanHistory((h) => [entry, ...h].slice(0, 50));
            } else {
              const isDuplicate = data.reason === "already_scanned";
              Haptics.notificationAsync(
                isDuplicate
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Error,
              );
              const resultType = isDuplicate
                ? ("already_scanned" as const)
                : ("not_found" as const);
              setScanResult({
                type: resultType,
                message: isDuplicate
                  ? "This ticket was already scanned"
                  : data.reason === "refunded"
                    ? "This ticket has been refunded"
                    : "This QR code is not a valid ticket",
              });
              setScanHistory((h) =>
                [
                  {
                    id: `${Date.now()}`,
                    type: resultType,
                    timestamp: Date.now(),
                  },
                  ...h,
                ].slice(0, 50),
              );
            }
          },
          onError: () => {
            // Offline fallback: validate against downloaded tokens
            if (hasOfflineData) {
              if (offlineStore.isAlreadyScanned(eventId, qrToken)) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
                setScanResult({
                  type: "already_scanned",
                  message: "This ticket was already scanned (offline)",
                });
                setScanHistory((h) =>
                  [
                    {
                      id: `${Date.now()}`,
                      type: "already_scanned" as const,
                      timestamp: Date.now(),
                    },
                    ...h,
                  ].slice(0, 50),
                );
              } else if (offlineStore.isTokenValid(eventId, qrToken)) {
                offlineStore.markScannedOffline(eventId, qrToken, authUser?.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setScanResult({
                  type: "success",
                  name: "Verified Offline",
                  tierName: undefined,
                });
                setScanCount((c) => c + 1);
                setScanHistory((h) =>
                  [
                    {
                      id: `${Date.now()}`,
                      type: "success" as const,
                      name: "Verified Offline",
                      timestamp: Date.now(),
                    },
                    ...h,
                  ].slice(0, 50),
                );
              } else {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
                setScanResult({
                  type: "not_found",
                  message: "Not a valid ticket (offline check)",
                });
                setScanHistory((h) =>
                  [
                    {
                      id: `${Date.now()}`,
                      type: "not_found" as const,
                      timestamp: Date.now(),
                    },
                    ...h,
                  ].slice(0, 50),
                );
              }
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setScanResult({
                type: "error",
                message:
                  "Network error. Download tickets for offline scanning.",
              });
            }
          },
        },
      );
    },
    [scanResult, scanMutation, authUser?.id, eventId],
  );

  const codeScanner =
    hasVisionCamera && useCodeScanner
      ? useCodeScanner({
          codeTypes: ["qr"],
          onCodeScanned: handleCodeScanned,
        })
      : null;

  const dismissResult = useCallback(() => {
    setScanResult(null);
    lastScannedRef.current = "";
    cooldownRef.current = false;
  }, []);

  // Fallback if VisionCamera not available
  if (!hasVisionCamera) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <ScanLine size={64} color="rgba(255,255,255,0.3)" />
        <Text className="text-white text-lg font-sans-semibold mt-4 text-center">
          Camera Scanner Unavailable
        </Text>
        <Text className="text-white/60 text-sm mt-2 text-center">
          react-native-vision-camera is required for ticket scanning. Please
          install it in your development build.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 bg-white/10 rounded-full px-6 py-3"
        >
          <Text className="text-white font-sans-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission.hasPermission) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <ScanLine size={64} color="rgba(255,255,255,0.3)" />
        <Text className="text-white text-lg font-sans-semibold mt-4 text-center">
          Camera Permission Required
        </Text>
        <Pressable
          onPress={() => permission.requestPermission()}
          className="mt-6 bg-primary rounded-full px-6 py-3"
        >
          <Text className="text-black font-sans-semibold">
            Grant Permission
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Camera */}
      {device && codeScanner && (
        <Camera
          style={{ flex: 1 }}
          device={device}
          isActive={true}
          codeScanner={codeScanner}
          torch={torchOn ? "on" : "off"}
        />
      )}

      {/* Scan overlay frame */}
      <View
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
        pointerEvents="none"
      >
        <View
          style={{
            width: 260,
            height: 260,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.4)",
            borderRadius: 24,
          }}
        />
      </View>

      {/* Top bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="w-10 h-10 items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(300)}>
          <Text className="text-white font-sans-bold text-lg">
            Scan Tickets
          </Text>
        </Animated.View>

        <Pressable
          onPress={() => setTorchOn((t) => !t)}
          className="w-10 h-10 items-center justify-center rounded-full bg-white/10"
        >
          {torchOn ? (
            <ZapOff size={18} color="#FCD34D" />
          ) : (
            <Zap size={18} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* Bottom stats + history */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          backgroundColor: "rgba(0,0,0,0.75)",
          maxHeight: showHistory ? 320 : undefined,
        }}
      >
        {/* Stats row */}
        <Pressable
          onPress={() => setShowHistory((v) => !v)}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2">
            <CheckCircle2 size={16} color="#22C55E" />
            <Text className="text-white font-sans-semibold text-sm">
              {scanCount} scanned
            </Text>
          </View>
          {scanHistory.length > 0 && (
            <Text className="text-white/50 text-xs">
              {showHistory
                ? "Hide history"
                : `${scanHistory.length} recent · Tap to expand`}
            </Text>
          )}
          {scanHistory.length === 0 && (
            <Text className="text-white/50 text-xs">
              Point camera at QR code
            </Text>
          )}
        </Pressable>

        {/* Scan history list */}
        {showHistory && scanHistory.length > 0 && (
          <ScrollView
            style={{ maxHeight: 220, marginTop: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {scanHistory.map((entry) => {
              const isOk = entry.type === "success";
              const isDup = entry.type === "already_scanned";
              const color = isOk ? "#22C55E" : isDup ? "#FBBF24" : "#EF4444";
              const label = isOk
                ? entry.name || "Checked In"
                : isDup
                  ? "Already Scanned"
                  : "Invalid";
              const time = new Date(entry.timestamp).toLocaleTimeString(
                "en-US",
                {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                },
              );
              return (
                <View
                  key={entry.id}
                  className="flex-row items-center justify-between py-2"
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: color,
                      }}
                    />
                    <Text
                      className="text-white text-xs font-sans-medium"
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {entry.tierName && (
                      <Text className="text-white/40 text-xs">
                        · {entry.tierName}
                      </Text>
                    )}
                  </View>
                  <Text className="text-white/30 text-[10px]">{time}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Scan result overlay */}
      {scanResult && (
        <ScanResultOverlay result={scanResult} onDismiss={dismissResult} />
      )}

      {/* Scanning indicator */}
      {scanMutation.isPending && !scanResult && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text className="text-white mt-2">Validating...</Text>
        </View>
      )}
    </View>
  );
}

export default function TicketScannerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <FeatureGate
      flag="organizer_tools_enabled"
      fallback={
        <View className="flex-1 bg-background items-center justify-center">
          <Text className="text-muted-foreground">Scanner not available</Text>
        </View>
      }
    >
      <ScannerContent eventId={id || ""} />
    </FeatureGate>
  );
}
