/**
 * Avatar Image Component
 * 
 * Uses expo-image with loading placeholder for avatars.
 * Dark theme, rounded corners, consistent styling.
 */

import { Image } from "expo-image";
import { View, ActivityIndicator } from "react-native";
import { useState } from "react";
import { User } from "lucide-react-native";

interface AvatarImageProps {
  uri?: string | null;
  size?: number;
  className?: string;
  showPlaceholder?: boolean;
}

const blurhash = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export function AvatarImage({
  uri,
  size = 40,
  className = "",
  showPlaceholder = true,
}: AvatarImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const showFallback = !uri || hasError;

  if (showFallback && showPlaceholder) {
    return (
      <View
        className={`bg-muted items-center justify-center ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      >
        <User size={size * 0.5} color="#666" />
      </View>
    );
  }

  if (showFallback) {
    return (
      <View
        className={`bg-muted ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
      className={className}
    >
      <Image
        source={{ uri: uri! }}
        style={{
          width: size,
          height: size,
        }}
        contentFit="cover"
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
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
}

/**
 * Small avatar for lists and comments
 */
export function SmallAvatar({ uri, className }: { uri?: string | null; className?: string }) {
  return <AvatarImage uri={uri} size={32} className={className} />;
}

/**
 * Medium avatar for feed posts
 */
export function MediumAvatar({ uri, className }: { uri?: string | null; className?: string }) {
  return <AvatarImage uri={uri} size={40} className={className} />;
}

/**
 * Large avatar for profile headers
 */
export function LargeAvatar({ uri, className }: { uri?: string | null; className?: string }) {
  return <AvatarImage uri={uri} size={80} className={className} />;
}

/**
 * Extra large avatar for profile edit
 */
export function XLargeAvatar({ uri, className }: { uri?: string | null; className?: string }) {
  return <AvatarImage uri={uri} size={120} className={className} />;
}
