import { Pressable, StyleSheet, View, Platform } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Plus } from "lucide-react-native"
import AnimatedGlow from "react-native-animated-glow"

interface GradientGlowButtonProps {
  onPress: () => void
  size?: number
  iconSize?: number
  focused?: boolean
}

export function GradientGlowButton({ 
  onPress, 
  size = 56, 
  iconSize = 28,
  focused = false
}: GradientGlowButtonProps) {
  const gradientColors = ["#34A2DF", "#8A40CF", "#FF5BFC"] as const

  const buttonContent = (
    <Pressable onPress={onPress} style={styles.pressable}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientButton,
          { width: size, height: size, borderRadius: size / 2 }
        ]}
      >
        <Plus size={iconSize} color="#fff" strokeWidth={2.5} />
      </LinearGradient>
    </Pressable>
  )

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={[styles.webGlow, { width: size + 20, height: size + 20, borderRadius: (size + 20) / 2 }]} />
        {buttonContent}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <AnimatedGlow
        color="#8A40CF"
        intensity={focused ? 0.8 : 0.5}
        size={size + 24}
        duration={2000}
      >
        {buttonContent}
      </AnimatedGlow>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  pressable: {
    shadowColor: "#8A40CF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  webGlow: {
    position: "absolute",
    backgroundColor: "rgba(138, 64, 207, 0.3)",
    shadowColor: "#8A40CF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
})
