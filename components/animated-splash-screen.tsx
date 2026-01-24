import { useEffect, useRef } from "react"
import { View, StyleSheet } from "react-native"
import Animated, { FadeOut } from "react-native-reanimated"
import { RiveView, useRiveFile } from "@rive-app/react-native"

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const animationFinished = useRef(false)
  const { riveFile, error } = useRiveFile(require("../assets/deviant.riv"))

  useEffect(() => {
    if (error) {
      console.error("[SplashScreen] Rive error:", error)
      // If there's an error, finish immediately
      if (!animationFinished.current) {
        animationFinished.current = true
        onAnimationFinish?.(false)
      }
      return
    }

    // Timer to finish animation after it plays (approximately 3.7 seconds)
    const timer = setTimeout(() => {
      if (!animationFinished.current) {
        animationFinished.current = true
        onAnimationFinish?.(false)
      }
    }, 3700)

    return () => clearTimeout(timer)
  }, [onAnimationFinish, error])

  return (
    <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
      <View style={styles.riveContainer}>
        {riveFile && !error ? (
          <RiveView
            file={riveFile}
            style={styles.rive}
            autoPlay={true}
            stateMachineName="Timeline 1"
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
