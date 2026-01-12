import { Platform, ViewStyle, ImageStyle } from "react-native"
import { Image, ImageProps } from "expo-image"
import Animated from "react-native-reanimated"

const AnimatedImage = Animated.createAnimatedComponent(Image)

interface SharedImageProps extends Omit<ImageProps, "style"> {
  sharedTag?: string
  style?: ImageStyle | ViewStyle
}

export function SharedImage({ sharedTag, style, ...props }: SharedImageProps) {
  if (Platform.OS === "web" || !sharedTag) {
    return <Image style={style as ImageStyle} {...props} />
  }

  return (
    <AnimatedImage
      // @ts-ignore - sharedTransitionTag is valid in Reanimated
      sharedTransitionTag={sharedTag}
      style={style as ImageStyle}
      {...props}
    />
  )
}
