import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import {
  RiveView,
  useRiveFile,
  Fit,
  type RiveError,
} from "@rive-app/react-native";
import { getApiBaseUrl } from "@/lib/api-config";

const BOOT_TIMEOUT_MS = 10000; // 10 second boot timeout
const ANIMATION_DURATION_MS = 9000; // 9 second animation

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

  const { riveFile, error: riveError } = useRiveFile(
    require("../assets/deviant.riv"),
  );

  // Check API health
  const checkApiHealth = async (): Promise<boolean> => {
    const API_URL = getApiBaseUrl();
    console.log("[Splash] Checking API health at:", API_URL);
    setApiStatus(`Connecting to ${API_URL}...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_URL}/api/users?limit=1`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("[Splash] API Health OK - Status:", res.status);
      setApiStatus(`Connected (${res.status})`);
      return res.ok;
    } catch (err: any) {
      console.error("[Splash] API Health FAIL:", err.message);
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

  // Finish splash helper
  const finishSplash = () => {
    if (!animationFinished.current && !hasCalledFinish) {
      animationFinished.current = true;
      hasCalledFinish = true;
      console.log("[Splash] Finishing splash screen");
      onAnimationFinish?.(false);
    }
  };

  useEffect(() => {
    if (riveError) {
      console.error("[Splash] Rive file load error:", riveError);
    }
  }, [riveError]);

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

  // Start timer only after Rive file is loaded
  useEffect(() => {
    // Guard: If already finished (from previous mount), don't start timer
    if (hasCalledFinish) {
      console.log(
        "[Splash] Already finished in previous mount, calling finish immediately",
      );
      onAnimationFinish?.(false);
      return;
    }

    if (!riveFile) {
      console.log("[Splash] Waiting for Rive file to load...");
      return;
    }

    console.log("[Splash] Rive file loaded, starting animation timer");
    const timer = setTimeout(() => {
      finishSplash();
    }, ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [riveFile, onAnimationFinish]);

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

  const handleRiveError = (err: RiveError) => {
    console.error("[Splash] Rive error:", err.message, "type:", err.type);
  };

  return (
    <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
      <View style={styles.riveContainer}>
        {riveFile ? (
          <RiveView
            file={riveFile}
            style={styles.rive}
            fit={Fit.Contain}
            autoPlay={true}
            onError={handleRiveError}
          />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  riveContainer: {
    backgroundColor: "#000",
    width: 300,
    height: 300,
  },
  rive: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
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
