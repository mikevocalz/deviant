import { Platform, ViewStyle, ImageStyle } from "react-native";
import { Image, ImageProps } from "expo-image";
import Animated from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

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
      style={style as ImageStyle}
      {...imageProps}
    />
  );
}
