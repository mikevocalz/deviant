import { useEffect, useRef } from "react"
import { View, Animated, StyleSheet, ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ 
  width = "100%", 
  height = 20, 
  borderRadius = 8,
  style 
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [shimmerAnim])

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  })

  return (
    <View 
      style={[
        styles.skeleton, 
        { 
          width: width as any, 
          height: height as any, 
          borderRadius 
        },
        style
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.08)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  )
}

export function SkeletonCircle({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
}

export function SkeletonText({ 
  width = "100%", 
  height = 14, 
  style 
}: { 
  width?: number | string
  height?: number
  style?: ViewStyle 
}) {
  return <Skeleton width={width} height={height} borderRadius={4} style={style} />
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  shimmer: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  gradient: {
    width: 200,
    height: "100%",
  },
})
