/**
 * Biometric Lock
 * Prompts for Face ID/Touch ID when app opens (if enabled)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useBiometrics } from "@/lib/hooks/use-biometrics";
import { Fingerprint, AlertCircle } from "lucide-react-native";
import { Motion } from "@legendapp/motion";
import { useColorScheme } from "@/lib/hooks";

export function BiometricLock() {
  const { colors } = useColorScheme();
  const { isEnabled, isAvailable, authenticate, getBiometricName } =
    useBiometrics();

  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticatingRef = useRef(false);

  const promptAuthentication = useCallback(async () => {
    if (!isEnabled || !isAvailable || isAuthenticatingRef.current) return;

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setError(null);

    const result = await authenticate("Unlock DVNT");

    isAuthenticatingRef.current = false;
    if (result.success) {
      setIsLocked(false);
      setIsAuthenticating(false);
    } else {
      setError(result.error || "Authentication failed");
      setIsAuthenticating(false);
    }
  }, [isEnabled, isAvailable, authenticate]);

  // Lock on mount if biometrics are enabled
  useEffect(() => {
    if (isEnabled && isAvailable) {
      setIsLocked(true);
      // Small delay to let the app render first
      setTimeout(() => {
        promptAuthentication();
      }, 300);
    }
  }, [isEnabled, isAvailable]);

  // Lock when app comes back from background
  useEffect(() => {
    if (!isEnabled || !isAvailable) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active" && !isAuthenticatingRef.current) {
          setIsLocked(true);
          setTimeout(() => {
            promptAuthentication();
          }, 100);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isEnabled, isAvailable, promptAuthentication]);

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
          Use {getBiometricName()} to access the app
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
          onPress={promptAuthentication}
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
