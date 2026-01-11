import { useCallback, useEffect, useRef } from "react"
import { Animated, Pressable, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

const TRACK_WIDTH = 52
const TRACK_HEIGHT = 32
const THUMB_SIZE = 28
const THUMB_OFFSET = 2

export function Switch({ checked, onCheckedChange, disabled = false }: SwitchProps) {
  const translateX = useRef(new Animated.Value(checked ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2 : 0)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: checked ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start()
  }, [checked, translateX])

  const handlePress = useCallback(() => {
    if (disabled) return

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start()

    onCheckedChange(!checked)
  }, [checked, onCheckedChange, disabled, scaleAnim])

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View style={[styles.track, { transform: [{ scale: scaleAnim }] }]}>
        {checked ? (
          <LinearGradient
            colors={["#34A2DF", "#8A40CF", "#FF5BFC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.trackOff]} />
        )}
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    padding: THUMB_OFFSET,
    overflow: "hidden",
  },
  trackOff: {
    backgroundColor: "#3A3A3C",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
})
