import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import {
  RiveView,
  useRiveFile,
  Fit,
  type RiveError,
} from "@rive-app/react-native";

// Module-level flag - persists across component remounts
let hasCalledFinish = false;

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void;
};

export default function AnimatedSplashScreen({
  onAnimationFinish,
}: AnimatedSplashScreenProps) {
  const animationFinished = useRef(hasCalledFinish);

  const { riveFile, error: riveError } = useRiveFile(
    require("../assets/deviant.riv"),
  );

  useEffect(() => {
    if (riveError) {
      console.error("[Splash] Rive file load error:", riveError);
    }
  }, [riveError]);

  // Start timer only after Rive file is loaded
  useEffect(() => {
    // Guard: If already finished (from previous mount), don't start timer
    if (hasCalledFinish) {
      console.log("[Splash] Already finished in previous mount, calling finish immediately");
      onAnimationFinish?.(false);
      return;
    }

    if (!riveFile) {
      console.log("[Splash] Waiting for Rive file to load...");
      return;
    }

    console.log("[Splash] Rive file loaded, starting 10 second timer");
    // Animation duration - 10 seconds (added 2 seconds total)
    const timer = setTimeout(() => {
      if (!animationFinished.current && !hasCalledFinish) {
        animationFinished.current = true;
        hasCalledFinish = true;
        console.log("[Splash] Animation timer completed, calling onAnimationFinish");
        onAnimationFinish?.(false);
      } else {
        console.log("[Splash] Timer completed but already finished, skipping");
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [riveFile, onAnimationFinish]);

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
            loop={false}
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
});
