import { useEffect, useRef } from "react"
import { View, StyleSheet } from "react-native"
import Animated, { FadeOut } from "react-native-reanimated"
import { RiveView, useRiveFile, useRive, Fit } from "@rive-app/react-native"

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const animationFinished = useRef(false)
  const { riveFile } = useRiveFile(require("../assets/deviant.riv"))
  const { riveViewRef, setHybridRef } = useRive()

  useEffect(() => {
    // Ensure animation plays when file loads
    if (riveFile && riveViewRef) {
      console.log("[Splash] Rive file loaded, starting animation");
      // Force play the animation
      riveViewRef.playIfNeeded?.();
    }
  }, [riveFile, riveViewRef])

  useEffect(() => {
    // Timer to finish animation after 6 seconds
    const timer = setTimeout(() => {
      if (!animationFinished.current) {
        animationFinished.current = true
        console.log("[Splash] Animation timer completed");
        onAnimationFinish?.(false)
      }
    }, 6000) // Animation needs 6000ms (6 seconds) to complete

    return () => clearTimeout(timer)
  }, [onAnimationFinish])

  if (!riveFile) {
    console.log("[Splash] Rive file not loaded yet");
    return (
      <View style={styles.container}>
        <View style={styles.riveContainer} />
      </View>
    )
  }

  console.log("[Splash] Rendering RiveView");

  return (
    <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
      <View style={styles.riveContainer}>
        <RiveView
          hybridRef={setHybridRef}
          file={riveFile}
          style={styles.rive}
          fit={Fit.Contain}
        />
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
