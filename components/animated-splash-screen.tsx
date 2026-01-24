import { useEffect, useRef, useState, useCallback } from "react";
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
  const loopCountRef = useRef(0);
  const onFinishRef = useRef(onAnimationFinish);
  
  // Keep callback ref up to date
  useEffect(() => {
    onFinishRef.current = onAnimationFinish;
  }, [onAnimationFinish]);

  const { riveFile, error } = useRiveFile(require("../assets/deviant.riv"));

  // Handle animation completion - only call once
  const handleAnimationComplete = useCallback(() => {
    if (!animationFinished.current) {
      console.log("[SplashScreen] Animation completed, calling onAnimationFinish");
      animationFinished.current = true;
      // Call immediately - no delay needed
      if (onFinishRef.current) {
        console.log("[SplashScreen] Calling onAnimationFinish callback");
        onFinishRef.current(false);
      } else {
        console.warn("[SplashScreen] onAnimationFinish callback is not provided!");
      }
    }
  }, []);

  // Primary timer - wait for full animation to play
  // Rive animations can be 4-8 seconds, so we'll use a longer timer
  useEffect(() => {
    // Wait for file to load first
    if (!riveFile && !error) {
      console.log("[SplashScreen] Waiting for Rive file to load...");
      return;
    }

    // If there's an error, finish after a short delay
    if (error) {
      console.log("[SplashScreen] Error loading Rive file, finishing after delay");
      const errorTimer = setTimeout(() => {
        handleAnimationComplete();
      }, 1000);
      return () => clearTimeout(errorTimer);
    }

    // Only start timer after animation actually starts playing
    if (!animationStarted) {
      console.log("[SplashScreen] Waiting for animation to start...");
      return;
    }

    console.log("[SplashScreen] Animation started, setting completion timer");
    
    // Set a long timer to ensure the FULL animation plays
    // Most splash animations are 4-8 seconds, so 8 seconds should be safe
    const completionTimer = setTimeout(() => {
      if (!animationFinished.current) {
        console.log("[SplashScreen] Completion timer reached (8s), finishing animation");
        handleAnimationComplete();
      }
    }, 8000); // 8 seconds to ensure full animation plays

    return () => {
      console.log("[SplashScreen] Cleaning up completion timer");
      clearTimeout(completionTimer);
    };
  }, [riveFile, error, animationStarted, handleAnimationComplete]);

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
            onLoopEnd={() => {
              loopCountRef.current += 1;
              console.log("[SplashScreen] Animation loop ended, loop count:", loopCountRef.current);
              // Don't finish on first loop - wait for timer or multiple loops
              // Only finish if we've looped multiple times (animation might be looping)
              if (loopCountRef.current >= 2) {
                console.log("[SplashScreen] Multiple loops detected, finishing");
                setTimeout(() => {
                  handleAnimationComplete();
                }, 500);
              }
            }}
            onStateChanged={(stateMachineName, stateName) => {
              console.log("[SplashScreen] State changed:", stateMachineName, stateName);
              // If animation reaches an "end" or "complete" state, finish
              if (stateName?.toLowerCase().includes("end") || stateName?.toLowerCase().includes("complete")) {
                console.log("[SplashScreen] Animation reached end state, finishing");
                setTimeout(() => {
                  handleAnimationComplete();
                }, 300);
              }
            }}
            // Don't use onStop - it fires too early when animation pauses
            // Let the timer handle completion
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
