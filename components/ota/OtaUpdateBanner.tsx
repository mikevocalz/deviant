import React, { useCallback } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOtaUpdateStore } from "@/lib/stores/ota-update-store";

let Updates: typeof import("expo-updates") | null = null;
if (Platform.OS !== "web") {
  try {
    Updates = require("expo-updates");
  } catch {}
}

/**
 * OtaUpdateBanner
 * Deterministic OTA update prompt — controlled entirely by useOtaUpdateStore.
 * Returns null (full unmount) when phase !== "visible". No animation orphans,
 * no sonner-native ghost overlays, no lingering pointer-event interceptors.
 */
export function OtaUpdateBanner() {
  const phase = useOtaUpdateStore((s) => s.phase);
  const dismiss = useOtaUpdateStore((s) => s.dismiss);
  const apply = useOtaUpdateStore((s) => s.apply);
  const insets = useSafeAreaInsets();

  const handleDismiss = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const handleApply = useCallback(async () => {
    apply();
    try {
      await Updates?.reloadAsync();
    } catch (e) {
      console.warn("[OtaUpdateBanner] reloadAsync failed (update applies on next cold start):", e);
    }
  }, [apply]);

  // Full unmount — zero residual overlay/backdrop/pointer-event layer
  if (phase !== "visible") return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 80,
        left: 16,
        right: 16,
        zIndex: 99999,
      }}
    >
      <View
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#333",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
          Update Ready
        </Text>
        <Text style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 12 }}>
          A new version has been downloaded and is ready to install.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={handleDismiss}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" }}>
              Update Later
            </Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: "#fff",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>
              Restart Now
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
