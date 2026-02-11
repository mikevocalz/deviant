import React from "react";
import { Platform, ViewStyle, ImageStyle } from "react-native";
import { Image, ImageProps } from "expo-image";
import Animated, { SharedTransition } from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface SharedImageProps extends Omit<ImageProps, "style"> {
  sharedTag?: string;
  style?: ImageStyle | ViewStyle;
}

// Inline error boundary — if the shared transition crashes, fall back to plain Image
class SharedImageErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[SharedImage] Transition error caught:", error.message);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function SharedImage({ sharedTag, style, ...props }: SharedImageProps) {
  const imageProps = {
    transition: 200,
    cachePolicy: "memory-disk" as const,
    ...props,
  };

  const plainImage = <Image style={style as ImageStyle} {...imageProps} />;

  if (Platform.OS === "web" || !sharedTag) {
    return plainImage;
  }

  return (
    <SharedImageErrorBoundary fallback={plainImage}>
      <AnimatedImage
        // @ts-ignore - sharedTransitionTag is valid in Reanimated
        sharedTransitionTag={sharedTag}
        // @ts-ignore - SharedTransition.duration returns a builder
        sharedTransitionStyle={SharedTransition.duration(300)}
        style={style as ImageStyle}
        {...imageProps}
      />
    </SharedImageErrorBoundary>
  );
}
