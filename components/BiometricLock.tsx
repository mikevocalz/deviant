/**
 * Biometric Lock
 * Prompts for Face ID/Touch ID when app opens (if enabled).
 *
 * CRITICAL: All guards are MODULE-LEVEL variables, NOT refs or state.
 * The parent (RootLayout) can remount this component when isAuthenticated
 * toggles during auth state loading. Refs reset on remount — module vars don't.
 * Once the user unlocks, `sessionUnlocked` stays true for the entire JS session.
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable, AppState } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Fingerprint, AlertCircle } from "lucide-react-native";
import { Motion } from "@legendapp/motion";
import { useColorScheme } from "@/lib/hooks";

const BIOMETRIC_ENABLED_KEY = "biometric_auth_enabled";

// ── Module-level guards — survive component remounts ──────────────────
let sessionUnlocked = false; // true after first successful Face ID this session
let authInProgress = false; // prevents concurrent Face ID prompts
let initDone = false; // prevents mount effect from re-running
let appStateListenerRegistered = false;
// Setter so the AppState listener (module-level) can tell the mounted component to re-lock
let setLockedFn: ((locked: boolean) => void) | null = null;

async function promptBiometric(): Promise<boolean> {
  if (authInProgress || sessionUnlocked) return sessionUnlocked;
  authInProgress = true;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock DVNT",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use Password",
    });
    if (result.success) {
      sessionUnlocked = true;
      setLockedFn?.(false);
    }
    return result.success;
  } catch {
    return false;
  } finally {
    authInProgress = false;
  }
}

// Register AppState listener ONCE at module level — never torn down by remounts
function ensureAppStateListener() {
  if (appStateListenerRegistered) return;
  appStateListenerRegistered = true;

  let prevState = AppState.currentState;
  AppState.addEventListener("change", (next) => {
    const was = prevState;
    prevState = next;

    if (next === "active" && was !== "active" && !authInProgress) {
      // Reset session unlock so user must re-authenticate after background
      SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).then((stored) => {
        if (stored === "true") {
          sessionUnlocked = false;
          setLockedFn?.(true);
          setTimeout(() => promptBiometric(), 100);
        }
      });
    }
  });
}

export function BiometricLock() {
  const { colors } = useColorScheme();

  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricName, setBiometricName] = useState("Face ID");

  // Wire up the module-level setter so external code can control lock state
  useEffect(() => {
    setLockedFn = setIsLocked;
    return () => {
      setLockedFn = null;
    };
  }, []);

  // Single init — skipped if already done this session (survives remounts)
  useEffect(() => {
    if (initDone || sessionUnlocked) return;
    initDone = true;

    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!compatible || !enrolled) return;

        const stored = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        if (stored !== "true") return;

        // Determine biometric name
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricName("Face ID");
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricName("Touch ID");
        }

        // Register AppState listener for background→foreground re-lock
        ensureAppStateListener();

        setIsLocked(true);
        setTimeout(() => promptBiometric(), 300);
      } catch (e) {
        console.error("[BiometricLock] Init error:", e);
      }
    })();
  }, []);

  // Manual retry handler
  const handleRetry = async () => {
    if (authInProgress) return;
    setIsAuthenticating(true);
    setError(null);

    const success = await promptBiometric();
    setIsAuthenticating(false);

    if (!success) {
      setError("Authentication failed. Tap to try again.");
    }
  };

  if (!isLocked || sessionUnlocked) {
    return null;
  }

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
        zIndex: 9999,
      }}
    >
      <Motion.View
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Fingerprint size={40} color={colors.primary} />
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 24,
            fontWeight: "600",
            color: colors.foreground,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Unlock DVNT
        </Text>

        {/* Description */}
        <Text
          style={{
            fontSize: 14,
            color: colors.mutedForeground,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Use {biometricName} to access the app
        </Text>

        {/* Error */}
        {error && (
          <Motion.View
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#ef444420",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <AlertCircle size={16} color="#ef4444" />
            <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
          </Motion.View>
        )}

        {/* Try Again Button */}
        <Pressable
          onPress={handleRetry}
          disabled={isAuthenticating}
          style={{
            backgroundColor: isAuthenticating
              ? colors.secondary
              : colors.primary,
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 8,
            minWidth: 200,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {isAuthenticating ? "Authenticating..." : "Try Again"}
          </Text>
        </Pressable>
      </Motion.View>
    </View>
  );
}
