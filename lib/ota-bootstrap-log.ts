/**
 * OTA Bootstrap Logger
 *
 * Runs at module initialization time — before any component renders — so
 * crashes that happen during root component setup still emit update state
 * to the console. Import this as the FIRST side-effect import in _layout.tsx.
 *
 * All expo-updates access is defensive. This module MUST NOT throw.
 */

import { Platform } from "react-native";

function safeGet<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

(function bootstrapOtaLog() {
  try {
    if (Platform.OS === "web") return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Updates = safeGet(() => require("expo-updates"), null);
    if (!Updates) {
      console.log("[OTA-BOOT] expo-updates unavailable (Expo Go / web)");
      return;
    }

    const isEnabled        = safeGet(() => Updates.isEnabled,            false);
    const isEmbedded       = safeGet(() => Updates.isEmbeddedLaunch,     true);
    const updateId         = safeGet(() => Updates.updateId,             null);
    const channel          = safeGet(() => Updates.channel,              null);
    const runtimeVersion   = safeGet(() => Updates.runtimeVersion,       null);
    const emergency        = safeGet(() => Updates.emergencyLaunchReason, null);
    const createdAt        = safeGet(() => {
      const d = Updates.createdAt;
      return d ? new Date(d).toISOString() : null;
    }, null);

    console.log("[OTA-BOOT] ========== LAUNCH ==========");
    console.log("[OTA-BOOT] isEnabled:            ", isEnabled);
    console.log("[OTA-BOOT] isEmbeddedLaunch:     ", isEmbedded);
    console.log("[OTA-BOOT] updateId:             ", updateId ?? "(none — embedded)");
    console.log("[OTA-BOOT] channel:              ", channel);
    console.log("[OTA-BOOT] runtimeVersion:       ", runtimeVersion);
    console.log("[OTA-BOOT] createdAt:            ", createdAt);
    console.log("[OTA-BOOT] emergencyLaunchReason:", emergency ?? "(none)");

    if (emergency) {
      console.error("[OTA-BOOT] ⚠️  EMERGENCY LAUNCH — reason:", emergency);
    }
    if (isEmbedded) {
      console.warn("[OTA-BOOT] Running embedded (binary) bundle — no OTA applied");
    }

    console.log("[OTA-BOOT] ================================");
  } catch (e) {
    // Swallow all — this logger must never crash the app
    console.warn("[OTA-BOOT] Bootstrap log error (non-fatal):", e);
  }
})();
