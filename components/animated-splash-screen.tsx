import { useEffect, useRef, useState } from "react"
import { View, StyleSheet } from "react-native"
import Animated, { FadeOut } from "react-native-reanimated"
import { RiveView, useRiveFile } from "@rive-app/react-native"

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const animationFinished = useRef(false)
  const [animationStarted, setAnimationStarted] = useState(false)
  const { riveFile, error } = useRiveFile(require("../assets/deviant.riv"))

  useEffect(() => {
    if (error) {
      console.error("[SplashScreen] Rive error:", error)
      // If there's an error, wait a bit then finish
      const timer = setTimeout(() => {
        if (!animationFinished.current) {
          animationFinished.current = true
          onAnimationFinish?.(false)
        }
      }, 2000)
      return () => clearTimeout(timer)
    }

    if (!riveFile) {
      // Wait for file to load
      return
    }

    // Mark animation as started once file is loaded
    setAnimationStarted(true)

    // Wait for animation to complete - Rive animations typically take 3-4 seconds
    // Give it extra time to ensure it plays fully (4.5 seconds total)
    const timer = setTimeout(() => {
      if (!animationFinished.current) {
        console.log("[SplashScreen] Animation timer completed");
        animationFinished.current = true
        onAnimationFinish?.(false)
      }
    }, 4500)

    return () => clearTimeout(timer)
  }, [onAnimationFinish, error, riveFile])

  return (
    <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
      <View style={styles.riveContainer}>
        {riveFile && !error ? (
          <RiveView
            file={riveFile}
            style={styles.rive}
            autoPlay={true}
            stateMachineName="Timeline 1"
            onPlay={() => {
              console.log("[SplashScreen] Animation started playing");
              setAnimationStarted(true);
            }}
          />
        ) : null}
      </View>
    </Animated.View>
  )
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
});
