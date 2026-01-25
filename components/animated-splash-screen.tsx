import { useEffect, useRef } from "react"
import { View, StyleSheet } from "react-native"
import Animated, { FadeOut } from "react-native-reanimated"
import { RiveView, useRiveFile, Fit, type RiveError } from "@rive-app/react-native"

type AnimatedSplashScreenProps = {
  onAnimationFinish?: (isCancelled: boolean) => void
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const animationFinished = useRef(false)

  const { riveFile, error: riveError } = useRiveFile(require("../assets/deviant.riv"))

  useEffect(() => {
    if (riveError) {
      console.error("[Splash] Rive file load error:", riveError)
    }
  }, [riveError])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!animationFinished.current) {
        animationFinished.current = true
        onAnimationFinish?.(false)
      }
    }, 6000)

    return () => clearTimeout(timer)
  }, [onAnimationFinish])

  const handleRiveError = (err: RiveError) => {
    console.error("[Splash] Rive error:", err.message, "type:", err.type)
  }

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
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
})
