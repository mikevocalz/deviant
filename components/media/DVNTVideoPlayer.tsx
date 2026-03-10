/**
 * DVNTVideoPlayer
 *
 * Reusable video player abstraction for DVNT.
 *
 * Internal implementation: expo-video (Expo SDK 55).
 *
 * Migration to react-native-video v7:
 *   1. Replace useVideoPlayer / VideoView imports with react-native-video's Video + VideoRef
 *   2. Map paused → paused prop, muted → muted prop
 *   3. Map onProgress to onProgress callback
 *   4. Map ref.seek → videoRef.current.seek(time)
 *   5. Map ref.presentFullscreen → videoRef.current.presentFullscreenPlayer()
 *   No changes required in any consuming component.
 *
 * Features:
 * - poster/thumbnail shown before play
 * - custom gradient seek bar (always visible, 4px from bottom)
 * - mute button top-right
 * - expand/fullscreen button bottom-right (video-only affordance)
 * - all controls use liquid glass treatment
 */
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  memo,
} from "react";
import { Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react-native";
import { DVNTLiquidGlassIconButton } from "./DVNTLiquidGlass";
import { DVNTSeekBar } from "./DVNTSeekBar";
import {
  useVideoLifecycle,
  safePlay,
  safePause,
  safeMute,
  safeSeek,
  safeGetCurrentTime,
  safeGetDuration,
  cleanupPlayer,
} from "@/lib/video-lifecycle";

export interface DVNTVideoPlayerRef {
  seek: (time: number) => void;
  presentFullscreen: () => void;
  dismissFullscreen: () => void;
  pause: () => void;
  play: () => void;
}

export interface DVNTVideoPlayerProps {
  source: string;
  postId: string;
  paused: boolean;
  muted: boolean;
  poster?: string | null;
  loop?: boolean;
  resizeMode?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
  onProgress?: (currentTime: number, duration: number) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onMuteToggle?: () => void;
  onFullscreenToggle?: () => void;
  showSeekBar?: boolean;
  isFullscreen?: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  onSeekEnd?: () => void;
  cardWidth?: number;
}

function DVNTVideoPlayerComponent(
  {
    source,
    postId,
    paused,
    muted,
    poster,
    loop = false,
    resizeMode = "cover",
    style,
    onProgress,
    onLoad,
    onEnd,
    onPress,
    onLongPress,
    onMuteToggle,
    onFullscreenToggle,
    showSeekBar = false,
    isFullscreen = false,
    currentTime = 0,
    duration = 0,
    onSeek,
    onSeekEnd,
    cardWidth,
  }: DVNTVideoPlayerProps,
  ref: React.Ref<DVNTVideoPlayerRef>,
) {
  const { isMountedRef, safeInterval, clearSafeInterval, isSafeToOperate } =
    useVideoLifecycle("DVNTVideoPlayer", postId);

  const player = useVideoPlayer(source || "", (p) => {
    if (p && source && isMountedRef.current) {
      try {
        p.loop = loop;
        p.muted = muted;
      } catch (_) {}
    }
  });

  // Expose imperative API — matches react-native-video v7 ref shape
  useImperativeHandle(ref, () => ({
    seek: (time: number) =>
      safeSeek(player, isMountedRef, time, "DVNTVideoPlayer"),
    presentFullscreen: () => onFullscreenToggle?.(),
    dismissFullscreen: () => onFullscreenToggle?.(),
    pause: () => safePause(player, isMountedRef, "DVNTVideoPlayer"),
    play: () => safePlay(player, isMountedRef, "DVNTVideoPlayer"),
  }));

  // Sync paused state
  useEffect(() => {
    if (!player || !source) return;
    if (isSafeToOperate()) {
      if (paused) {
        safePause(player, isMountedRef, "DVNTVideoPlayer");
      } else {
        safePlay(player, isMountedRef, "DVNTVideoPlayer");
      }
    }
    return () => {
      if (player) cleanupPlayer(player, "DVNTVideoPlayer");
    };
  }, [paused, player, source, isSafeToOperate, isMountedRef]);

  // Sync mute state
  useEffect(() => {
    if (player && source) {
      safeMute(player, isMountedRef, muted, "DVNTVideoPlayer");
    }
  }, [muted, player, source, isMountedRef]);

  // Poll progress for seek bar
  useEffect(() => {
    if (!player || !source || paused) return;

    const interval = safeInterval(() => {
      if (!isSafeToOperate()) return;
      const ct = safeGetCurrentTime(player, isMountedRef, "DVNTVideoPlayer");
      const dur = safeGetDuration(player, isMountedRef, "DVNTVideoPlayer");
      onProgress?.(ct, dur);
      if (dur > 0 && ct >= dur - 0.2) {
        onEnd?.();
      }
    }, 250);

    return () => clearSafeInterval(interval);
  }, [
    player,
    source,
    paused,
    onProgress,
    onEnd,
    safeInterval,
    clearSafeInterval,
    isMountedRef,
    isSafeToOperate,
  ]);

  // onLoad — once
  const didReportLoad = useRef(false);
  useEffect(() => {
    if (!player || !source || didReportLoad.current) return;
    const interval = safeInterval(() => {
      const dur = safeGetDuration(player, isMountedRef, "DVNTVideoPlayer");
      if (dur > 0 && !didReportLoad.current) {
        didReportLoad.current = true;
        clearSafeInterval(interval);
        onLoad?.(dur);
      }
    }, 200);
    return () => clearSafeInterval(interval);
  }, [player, source, onLoad, safeInterval, clearSafeInterval, isMountedRef]);

  const showPoster = !!poster && paused;

  return (
    <View style={[{ width: "100%", height: "100%" }, style]}>
      {/* Video layer */}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
        style={{ width: "100%", height: "100%" }}
      >
        <View pointerEvents="none" style={{ width: "100%", height: "100%" }}>
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            contentFit={resizeMode}
            nativeControls={false}
          />
        </View>
      </Pressable>

      {/* Poster overlay — fades out when playing */}
      {showPoster && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          <Image
            source={{ uri: poster }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      )}

      {/* Mute button — top-right */}
      {onMuteToggle && (
        <Pressable
          onPress={onMuteToggle}
          style={{ position: "absolute", top: 12, right: 12 }}
          hitSlop={12}
        >
          <DVNTLiquidGlassIconButton size={34}>
            {muted ? (
              <VolumeX size={16} color="#fff" />
            ) : (
              <Volume2 size={16} color="#fff" />
            )}
          </DVNTLiquidGlassIconButton>
        </Pressable>
      )}

      {/* Expand/fullscreen button — bottom-right */}
      {onFullscreenToggle && (
        <Pressable
          onPress={onFullscreenToggle}
          style={{ position: "absolute", bottom: 16, right: 12 }}
          hitSlop={12}
        >
          <DVNTLiquidGlassIconButton size={34}>
            {isFullscreen ? (
              <Minimize2 size={16} color="#fff" />
            ) : (
              <Maximize2 size={16} color="#fff" />
            )}
          </DVNTLiquidGlassIconButton>
        </Pressable>
      )}

      {/* Always-on seek bar — 4px from bottom */}
      <DVNTSeekBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        onSeekEnd={onSeekEnd}
        barWidth={cardWidth ? cardWidth - 32 : undefined}
      />
    </View>
  );
}

export const DVNTVideoPlayer = memo(forwardRef(DVNTVideoPlayerComponent));
