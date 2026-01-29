import { View, Text } from "react-native";
import { Image } from "expo-image";
import { memo } from "react";
import { resolveAvatarUrl } from "@/lib/media/resolveAvatarUrl";

// Preset sizes for consistency
export const AvatarSizes = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
  xl: 80,
  xxl: 100,
} as const;

export type AvatarSize = keyof typeof AvatarSizes | number;
export type AvatarVariant = "roundedSquare" | "circle";

export interface AvatarProps {
  /** Image URI or media object - resolved internally */
  uri?: unknown;
  /** Username for generating fallback avatar */
  username?: string;
  /** Size - can be preset name or number */
  size?: AvatarSize;
  /** Shape variant - roundedSquare (default) or circle */
  variant?: AvatarVariant;
  /** Additional style overrides */
  style?: object;
}

const FALLBACK_BG = "#3EA4E5";

/**
 * Reusable UserAvatar component
 *
 * Usage:
 * <UserAvatar uri={user.avatar} username={user.username} size="md" variant="roundedSquare" />
 *
 * Features:
 * - Two variants: roundedSquare (default, Instagram-like) or circle
 * - Preset sizes: xs(24), sm(32), md(44), lg(64), xl(80), xxl(100)
 * - Custom numeric size support
 * - Automatic fallback to UI Avatars API
 * - Memory-disk caching for performance
 */
function AvatarComponent({
  uri,
  username = "User",
  size = "md",
  variant = "roundedSquare",
  style,
}: AvatarProps) {
  // Resolve size to number
  const sizeValue = typeof size === "number" ? size : AvatarSizes[size];

  // Calculate border radius based on variant
  const borderRadius =
    variant === "circle"
      ? sizeValue / 2
      : Math.min(Math.round(sizeValue * 0.18), 16); // ~18% of size, max 16

  // CRITICAL: Use resolveAvatarUrl to handle string OR media object
  // This ensures expo-image ALWAYS gets a valid URL string
  const resolvedUri = resolveAvatarUrl(
    uri,
    __DEV__ ? `Avatar:${username}` : undefined,
  );
  const showImage = Boolean(resolvedUri);
  const usernameInitial =
    (username && username.trim().length > 0
      ? username.trim()[0].toUpperCase()
      : "U");

  if (__DEV__) {
    console.log(
      `[UserAvatar] ${username}: raw=${JSON.stringify(
        uri,
      )} resolved=${resolvedUri}`,
    );
  }

  return (
    <View
      style={[
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius,
          backgroundColor: "#2a2a2a",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: resolvedUri! }}
          style={{
            width: sizeValue,
            height: sizeValue,
          }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            width: sizeValue,
            height: sizeValue,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: FALLBACK_BG,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "700",
              fontSize: Math.round(sizeValue / 2),
            }}
          >
            {usernameInitial}
          </Text>
        </View>
      )}
    </View>
  );
}

export const Avatar = memo(AvatarComponent);

// Alias for semantic clarity
export const UserAvatar = Avatar;
