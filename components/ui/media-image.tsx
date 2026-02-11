/**
 * Media Image Component
 *
 * Uses expo-image with loading placeholder for post/story/event media.
 * Dark theme, consistent styling with loading indicators.
 */

import { Image } from "expo-image";
import { View, ActivityIndicator, Pressable } from "react-native";
import { useState } from "react";
import { ImageOff } from "lucide-react-native";

interface MediaImageProps {
  uri?: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  className?: string;
  onPress?: () => void;
  showErrorPlaceholder?: boolean;
}

const blurhash = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export function MediaImage({
  uri,
  width,
  height,
  aspectRatio = 1,
  contentFit = "cover",
  className = "",
  onPress,
  showErrorPlaceholder = true,
}: MediaImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const showFallback = !uri || hasError;

  const containerStyle = {
    width,
    height: height || undefined,
    aspectRatio: !height ? aspectRatio : undefined,
  };

  if (showFallback && showErrorPlaceholder) {
    return (
      <View
        className={`bg-muted items-center justify-center ${className}`}
        style={containerStyle}
      >
        <ImageOff size={32} color="#666" />
      </View>
    );
  }

  if (showFallback) {
    return <View className={`bg-muted ${className}`} style={containerStyle} />;
  }

  const imageContent = (
    <View style={containerStyle} className={className}>
      <Image
        source={{ uri: uri! }}
        style={{ width: "100%", height: "100%" }}
        contentFit={contentFit}
        placeholder={{ blurhash }}
        transition={200}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
      {isLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{imageContent}</Pressable>;
  }

  return imageContent;
}

/**
 * Square thumbnail for grids
 */
export function ThumbnailImage({
  uri,
  size = 120,
  onPress,
  className,
}: {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <MediaImage
      uri={uri}
      width={size}
      height={size}
      aspectRatio={1}
      onPress={onPress}
      className={className}
    />
  );
}

/**
 * Feed post image (1:1 square aspect ratio)
 */
export function FeedImage({
  uri,
  onPress,
  className,
}: {
  uri?: string | null;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <MediaImage
      uri={uri}
      aspectRatio={1}
      onPress={onPress}
      className={className}
    />
  );
}

/**
 * Story image (9:16 aspect ratio)
 */
export function StoryImage({
  uri,
  onPress,
  className,
}: {
  uri?: string | null;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <MediaImage
      uri={uri}
      aspectRatio={9 / 16}
      contentFit="cover"
      onPress={onPress}
      className={className}
    />
  );
}

/**
 * Event cover image (16:9 aspect ratio)
 */
export function EventCoverImage({
  uri,
  onPress,
  className,
}: {
  uri?: string | null;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <MediaImage
      uri={uri}
      aspectRatio={16 / 9}
      onPress={onPress}
      className={className}
    />
  );
}
