import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
// import {
//   RiveView,
//   useRiveFile,
//   Fit,
//   type RiveError,
// } from "@rive-app/react-native";
// Supabase URL for health checks
const _rawSplashUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_URL =
  typeof _rawSplashUrl === "string" && _rawSplashUrl.startsWith("https://")
    ? _rawSplashUrl
    : "https://npfjanxturvmjyevoyfo.supabase.co";

const BOOT_TIMEOUT_MS = 1000; // 1 second max (hard cap)
const ANIMATION_DURATION_MS = 1000; // 0.8 second display time

// Module-level flag - persists across component remounts
let hasCalledFinish = false;

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void;
};

export default function AnimatedSplashScreen({
  onAnimationFinish,
}: AnimatedSplashScreenProps) {
  const animationFinished = useRef(hasCalledFinish);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  // Polished icon animation
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const glowOpacity = useSharedValue(0);

  // const { riveFile, error: riveError } = useRiveFile(
  //   require("../assets/deviant.riv"),
  // );

  // Check Supabase health
  const checkApiHealth = async (): Promise<boolean> => {
    console.log("[Splash] Checking Supabase health at:", SUPABASE_URL);
    setApiStatus(`Connecting to Supabase...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?limit=1`, {
        signal: controller.signal,
        headers: {
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
        },
      });
      clearTimeout(timeoutId);
      console.log("[Splash] Supabase Health OK - Status:", res.status);
      setApiStatus(`Connected (${res.status})`);
      return res.ok;
    } catch (err: any) {
      console.error("[Splash] Supabase Health FAIL:", err.message);
      setApiStatus(`Failed: ${err.message}`);
      return false;
    }
  };

  // Handle retry
  const handleRetry = async () => {
    console.log("[Splash] Retry button pressed");
    setIsRetrying(true);
    setBootTimedOut(false);

    const healthy = await checkApiHealth();
    if (healthy) {
      // API is healthy, finish splash
      finishSplash();
    } else {
      // Still failing, show timeout UI again
      setBootTimedOut(true);
    }
    setIsRetrying(false);
  };

  // Finish splash helper - instant exit
  const finishSplash = () => {
    if (!animationFinished.current && !hasCalledFinish) {
      animationFinished.current = true;
      hasCalledFinish = true;
      console.log("[Splash] Finishing splash screen");
      onAnimationFinish?.(false);
    }
  };

  // Fast animation sequence
  useEffect(() => {
    // Instant fade + scale
    opacity.value = withTiming(1, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });

    scale.value = withSequence(
      withTiming(1.05, {
        duration: 100,
        easing: Easing.out(Easing.back(1.2)),
      }),
      withTiming(1, {
        duration: 100,
        easing: Easing.out(Easing.quad),
      }),
    );

    // Quick glow
    glowOpacity.value = withDelay(
      100,
      withSequence(
        withTiming(0.3, { duration: 200 }),
        withTiming(0.15, { duration: 350 }),
      ),
    );
  }, []);

  // useEffect(() => {
  //   if (riveError) {
  //     console.error("[Splash] Rive file load error:", riveError);
  //   }
  // }, [riveError]);

  // Boot timeout - ensures app never gets stuck
  useEffect(() => {
    if (hasCalledFinish) return;

    const bootTimer = setTimeout(() => {
      if (!animationFinished.current && !hasCalledFinish) {
        console.warn(
          "[Splash] Boot timeout reached after",
          BOOT_TIMEOUT_MS,
          "ms",
        );
        checkApiHealth().then((healthy) => {
          if (!healthy) {
            setBootTimedOut(true);
          } else {
            // API is healthy but animation didn't finish - force finish
            finishSplash();
          }
        });
      }
    }, BOOT_TIMEOUT_MS);

    return () => clearTimeout(bootTimer);
  }, []);

  // Start timer immediately - fast boot
  useEffect(() => {
    // Guard: If already finished (from previous mount), don't start timer
    if (hasCalledFinish) {
      console.log(
        "[Splash] Already finished in previous mount, calling finish immediately",
      );
      onAnimationFinish?.(false);
      return;
    }

    // Check API health in parallel (non-blocking)
    checkApiHealth().then((healthy) => {
      if (!healthy) {
        console.warn("[Splash] API check failed, but continuing boot");
      }
    });

    console.log("[Splash] Starting fast icon splash timer");
    const timer = setTimeout(() => {
      finishSplash();
    }, ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onAnimationFinish]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [
      {
        scale: interpolate(
          glowOpacity.value,
          [0, 0.4],
          [0.8, 1.2],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Show timeout/retry UI
  if (bootTimedOut) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Can't reach server</Text>
          <Text style={styles.errorMessage}>{apiStatus}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.retryText}>Retry</Text>
            )}
          </Pressable>
          <Pressable style={styles.skipButton} onPress={finishSplash}>
            <Text style={styles.skipText}>Continue Anyway</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // const handleRiveError = (err: RiveError) => {
  //   console.error("[Splash] Rive error:", err.message, "type:", err.type);
  // };

  return (
    <View style={styles.container}>
      {/* Subtle radial glow */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={[
            "rgba(62, 164, 229, 0.15)",
            "rgba(255, 109, 193, 0.08)",
            "transparent",
          ]}
          style={styles.glow}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* App icon */}
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.icon}
          contentFit="contain"
          priority="high"
        />
      </Animated.View>
    </View>
  );

  // RIVE SPLASH (preserved for rollback):
  // return (
  //   <View style={styles.container}>
  //     <View style={styles.riveContainer}>
  //       {riveFile ? (
  //         <RiveView
  //           file={riveFile}
  //           style={styles.rive}
  //           fit={Fit.Contain}
  //           autoPlay={true}
  //           onError={handleRiveError}
  //         />
  //       ) : (
  //         <View style={styles.placeholder} />
  //       )}
  //     </View>
  //   </View>
  // );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  icon: {
    width: "100%",
    height: "100%",
  },
  glowContainer: {
    position: "absolute",
    width: 350,
    height: 350,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  glow: {
    width: "100%",
    height: "100%",
    borderRadius: 175,
  },
  // riveContainer: {
  //   backgroundColor: "#000",
  //   width: 300,
  //   height: 300,
  // },
  // rive: {
  //   width: "100%",
  //   height: "100%",
  // },
  // placeholder: {
  //   width: "100%",
  //   height: "100%",
  //   backgroundColor: "#000",
  // },
  errorContainer: {
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  errorMessage: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#3EA4E5",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 140,
    alignItems: "center",
    marginBottom: 12,
  },
  retryText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  skipText: {
    color: "#666",
    fontSize: 14,
  },
});
