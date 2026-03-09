/**
 * DVNTLivePhotoView
 * iOS: Renders a Live Photo using expo-live-photo (tap-and-hold to play).
 * Android / Web: Falls back to the still image via expo-image.
 *
 * expo-live-photo requires a native build. The component degrades gracefully
 * if the module has not been compiled into the binary yet.
 */
import { View, ViewStyle, Platform } from "react-native";
import { Image } from "expo-image";
import type { ImageStyle } from "expo-image";
import { useRef } from "react";

interface DVNTLivePhotoViewProps {
  photoUri: string;
  videoUri?: string;
  width: number | string;
  height: number | string;
  style?: ViewStyle;
  contentFit?: "cover" | "contain";
  accessibilityLabel?: string;
}

let LivePhotoView: React.ComponentType<any> | null = null;
let livePhotoIsAvailable: (() => boolean) | null = null;

if (Platform.OS === "ios") {
  try {
    const mod = require("expo-live-photo");
    LivePhotoView = mod.LivePhotoView;
    livePhotoIsAvailable = mod.isAvailable;
  } catch {
    // expo-live-photo not yet compiled into this build
    LivePhotoView = null;
    livePhotoIsAvailable = null;
  }
}

export function DVNTLivePhotoView({
  photoUri,
  videoUri,
  width,
  height,
  style,
  contentFit = "cover",
  accessibilityLabel,
}: DVNTLivePhotoViewProps) {
  const viewRef = useRef<any>(null);

  const canRenderLivePhoto =
    Platform.OS === "ios" &&
    LivePhotoView !== null &&
    videoUri != null &&
    videoUri.startsWith("http") &&
    (livePhotoIsAvailable?.() ?? false);

  if (canRenderLivePhoto && LivePhotoView) {
    return (
      <View style={[{ width, height } as ViewStyle, style]}>
        <LivePhotoView
          ref={viewRef}
          source={{ photoUri, videoUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit={contentFit}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    );
  }

  return (
    <View style={[{ width, height } as ViewStyle, style]}>
      <Image
        source={{ uri: photoUri }}
        style={{ width: "100%", height: "100%" } as ImageStyle}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={200}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}
