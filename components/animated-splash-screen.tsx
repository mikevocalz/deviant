import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { RiveView, useRiveFile } from "@rive-app/react-native";

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void;
};

export default function AnimatedSplashScreen({
  onAnimationFinish,
}: AnimatedSplashScreenProps) {
  const animationFinished = useRef(false);
  const [animationStarted, setAnimationStarted] = useState(false);
  const { riveFile, error } = useRiveFile(require("../assets/deviant.riv"));

  // Handle animation completion
  const handleAnimationComplete = () => {
    if (!animationFinished.current) {
      console.log("[SplashScreen] Animation completed");
      animationFinished.current = true;
      onAnimationFinish?.(false);
    }
  };

  // Fallback timer - ensure we don't wait forever if animation doesn't complete
  useEffect(() => {
    // Wait for file to load first
    if (!riveFile && !error) {
      return;
    }

    // If there's an error, finish immediately
    if (error) {
      console.log("[SplashScreen] Error loading Rive file, finishing immediately");
      handleAnimationComplete();
      return;
    }

    // Set a longer fallback timer to ensure animation plays fully
    // Most Rive animations are 3-5 seconds, so 6 seconds should be safe
    const fallbackTimer = setTimeout(() => {
      if (!animationFinished.current) {
        console.log("[SplashScreen] Fallback timer reached, finishing animation");
        handleAnimationComplete();
      }
    }, 6000); // Increased to 6 seconds to ensure full animation plays

    return () => clearTimeout(fallbackTimer);
  }, [riveFile, error, onAnimationFinish]);

  return (
    <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
      <View style={styles.riveContainer}>
        {riveFile ? (
          <RiveView
            file={riveFile}
            style={styles.rive}
            autoPlay={true}
            onPlay={() => {
              console.log("[SplashScreen] Animation started playing");
              setAnimationStarted(true);
            }}
            onStop={() => {
              console.log("[SplashScreen] Animation stopped");
              // Animation stopped - it completed or was interrupted
              handleAnimationComplete();
            }}
            onLoopEnd={() => {
              console.log("[SplashScreen] Animation loop ended");
              // If animation loops, wait for it to complete at least one full cycle
              // Then finish after a short delay to ensure smooth transition
              setTimeout(() => {
                handleAnimationComplete();
              }, 300);
            }}
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            {/* Show nothing on error, just finish quickly */}
          </View>
        ) : null}
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
    backgroundColor: "#000",
    width: "100%",
    height: "100%",
  },
  errorContainer: {
    width: "100%",
    height: "100%",
  },
});
