import { Platform, ViewStyle, ImageStyle } from "react-native";
import { Image, ImageProps } from "expo-image";
import Animated, { SharedTransition } from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Smooth spring transition for shared element animations
const sharedTransition = SharedTransition.duration(400)
  .springify()
  .damping(18)
  .stiffness(200);

interface SharedImageProps extends Omit<ImageProps, "style"> {
  sharedTag?: string;
  style?: ImageStyle | ViewStyle;
}

export function SharedImage({ sharedTag, style, ...props }: SharedImageProps) {
  const imageProps = {
    transition: 200,
    cachePolicy: "memory-disk" as const,
    ...props,
  };

  if (Platform.OS === "web" || !sharedTag) {
    return <Image style={style as ImageStyle} {...imageProps} />;
  }

  return (
    <AnimatedImage
      // @ts-ignore - sharedTransitionTag is valid in Reanimated
      sharedTransitionTag={sharedTag}
      sharedTransitionStyle={sharedTransition}
      style={style as ImageStyle}
      {...imageProps}
    />
  );
}
