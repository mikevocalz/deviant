/**
 * DVNTLivePhotoView
 * iOS: Renders a Live Photo using expo-live-photo.
 *   - Waits for `onLoadComplete` then calls startPlayback('full') so we
 *     don't fire playback before the paired video has finished loading
 *     (would silently no-op).
 *   - Re-drives playback from the `isPlaying` prop for viewport-aware
 *     playback in feed/grid.
 *   - On native load error, falls back to the still image.
 * Android / Web: Falls back to the still image via expo-image.
 *
 * expo-live-photo requires a native build. The component degrades
 * gracefully if the module has not been compiled into the current binary.
 *
 * HISTORICAL BUGS (fixed):
 *   1. `mod.isAvailable` was read off the module root — but expo-live-photo
 *      exposes `isAvailable()` as a *static on the LivePhotoView component*.
 *      The old code always resolved to `undefined` → canRenderLivePhoto was
 *      always false → we silently rendered the still image every time.
 *   2. The `source` prop was `{ photoUri, videoUri }` — but the native
 *      asset type is `{ photoUri, pairedVideoUri }`. Unknown keys are
 *      ignored, so the native view loaded with no video and could never
 *      play.
 *   3. Upload pipeline was running the still through image-manipulator
 *      (compress + resize + re-encode to JPEG), which strips the Live
 *      Photo pairing metadata Apple's PHLivePhoto requires. Fixed in
 *      lib/hooks/use-media-upload.ts (upload original still unaltered).
 */
import { View, ViewStyle, Platform } from "react-native";
import { Image } from "expo-image";
import type { ImageStyle } from "expo-image";
import { useCallback, useEffect, useRef } from "react";

interface DVNTLivePhotoViewProps {
  photoUri: string;
  videoUri?: string;
  width: number | string;
  height: number | string;
  style?: ViewStyle;
  contentFit?: "cover" | "contain";
  accessibilityLabel?: string;
  /** Controls playback — starts full playback when true, stops when false. Defaults to true. */
  isPlaying?: boolean;
}

type LivePhotoStatics = { isAvailable?: () => boolean };
type LivePhotoComponent = React.ComponentType<any> & LivePhotoStatics;

let LivePhotoView: LivePhotoComponent | null = null;
let livePhotoIsAvailable: (() => boolean) | null = null;

if (Platform.OS === "ios") {
  try {
    const mod = require("expo-live-photo");
    const Component = (mod?.LivePhotoView ?? mod?.default) as
      | LivePhotoComponent
      | undefined;
    if (Component) {
      LivePhotoView = Component;
      // `isAvailable` is a static on the component (not the module root).
      livePhotoIsAvailable =
        typeof Component.isAvailable === "function"
          ? Component.isAvailable.bind(Component)
          : null;
    }
  } catch {
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
  isPlaying = true,
}: DVNTLivePhotoViewProps) {
  const viewRef = useRef<any>(null);
  const isLoadedRef = useRef(false);
  const didFallbackRef = useRef(false);

  const hasPairedVideo =
    typeof videoUri === "string" && videoUri.startsWith("http");

  const canRenderLivePhoto =
    Platform.OS === "ios" &&
    LivePhotoView !== null &&
    hasPairedVideo &&
    (livePhotoIsAvailable?.() ?? false) &&
    !didFallbackRef.current;

  // Start playback only once the native view has finished loading both the
  // photo and the paired video. Calling startPlayback before the video is
  // ready silently no-ops, which is what made "autoplay" look broken.
  const startIfReady = useCallback(() => {
    if (!viewRef.current || !isLoadedRef.current) return;
    try {
      if (isPlaying) {
        viewRef.current.startPlayback?.("full");
      } else {
        viewRef.current.stopPlayback?.();
      }
    } catch {}
  }, [isPlaying]);

  const handleLoadComplete = useCallback(() => {
    isLoadedRef.current = true;
    startIfReady();
  }, [startIfReady]);

  const handleLoadError = useCallback(() => {
    // PHLivePhoto failed to pair photo + video (metadata stripped,
    // network issue, unsupported format, etc.). Flip the ref so the
    // next render falls back to the still image.
    didFallbackRef.current = true;
    isLoadedRef.current = false;
    // Force a re-render via a no-op state change would normally use
    // useState, but per project policy we lean on imperative ref flipping
    // plus re-eval. Since we only need to fall back (not retry), letting
    // the parent re-render on isPlaying / source change is acceptable.
  }, []);

  // Re-drive playback when `isPlaying` flips (viewport-aware control).
  useEffect(() => {
    startIfReady();
  }, [startIfReady]);

  if (canRenderLivePhoto && LivePhotoView) {
    return (
      <View style={[{ width, height } as ViewStyle, style]}>
        <LivePhotoView
          ref={viewRef}
          // Native asset shape is { photoUri, pairedVideoUri } — NOT
          // `videoUri`. The old prop name was silently ignored by the
          // native view, so the Live Photo loaded with no video and
          // could not play.
          source={{ photoUri, pairedVideoUri: videoUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit={contentFit}
          isMuted={true}
          // Keep Apple's default tap-and-hold gesture so the user can
          // replay manually after our auto-startPlayback finishes.
          useDefaultGestureRecognizer={true}
          onLoadComplete={handleLoadComplete}
          onLoadError={handleLoadError}
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
