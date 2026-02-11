/**
 * Biometric Lock
 * Prompts for Face ID/Touch ID when app opens (if enabled).
 *
 * IMPORTANT: All control-flow guards use refs, NOT state, so that
 * callback identity never changes and effects never re-fire.
 */

import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  AppState,
  type AppStateStatus,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Fingerprint, AlertCircle } from "lucide-react-native";
import { Motion } from "@legendapp/motion";
import { useColorScheme } from "@/lib/hooks";

const BIOMETRIC_ENABLED_KEY = "biometric_auth_enabled";

export function BiometricLock() {
  const { colors } = useColorScheme();

  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricName, setBiometricName] = useState("Face ID");

  // Refs for control flow — never cause re-renders or effect re-fires
  const busyRef = useRef(false);
  const hasPromptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Direct authenticate call — no hooks, no deps, no identity changes
  const doAuthenticate = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock DVNT",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
        fallbackLabel: "Use Password",
      });

      if (result.success) {
        setIsLocked(false);
      } else {
        setError(result.error || "Authentication failed");
      }
    } catch (e: any) {
      setError(e?.message || "Authentication error");
    } finally {
      busyRef.current = false;
      setIsAuthenticating(false);
    }
  };

  // Single mount effect — check if biometrics enabled, lock + prompt once
  useEffect(() => {
    let cancelled = false;

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

        if (cancelled || hasPromptedRef.current) return;
        hasPromptedRef.current = true;

        setIsLocked(true);
        // Small delay to let the UI render the lock screen first
        setTimeout(() => {
          if (!cancelled) doAuthenticate();
        }, 300);
      } catch (e) {
        console.error("[BiometricLock] Init error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // Empty deps — runs exactly once

  // AppState listener — re-lock when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = next;

        // Only trigger when coming FROM background/inactive TO active
        if (next === "active" && prev !== "active" && !busyRef.current) {
          // Re-check if biometrics still enabled (async but fire-and-forget)
          SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).then((stored) => {
            if (stored === "true") {
              setIsLocked(true);
              setTimeout(() => doAuthenticate(), 100);
            }
          });
        }
      },
    );

    return () => subscription.remove();
  }, []); // Empty deps — stable listener, never re-subscribes

  if (!isLocked) {
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
          onPress={doAuthenticate}
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
