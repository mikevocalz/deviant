/**
 * CameraScreen — Full Instagram-style camera experience
 *
 * Features: Photo/Video toggle, flip, flash, recording timer,
 * gallery shortcut, pinch-to-zoom
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  type PhotoFile,
  type VideoFile,
  type CameraPosition,
} from "react-native-vision-camera";
import {
  X,
  Zap,
  ZapOff,
  RotateCcw,
  Image as ImageIcon,
  Camera as CameraIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Brightness from "expo-brightness";
import * as MediaLibrary from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Motion } from "@legendapp/motion";

type CameraMode = "photo" | "video";
type FlashMode = "off" | "on" | "auto";

export interface CapturedMedia {
  uri: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
}

interface CameraScreenProps {
  onCapture: (media: CapturedMedia) => void;
  onClose: () => void;
  allowedModes?: CameraMode[];
  maxVideoDuration?: number;
  showGallery?: boolean;
  onGalleryPress?: () => void;
}

export function CameraScreen({
  onCapture,
  onClose,
  allowedModes = ["photo", "video"],
  maxVideoDuration = 60,
  showGallery = true,
  onGalleryPress,
}: CameraScreenProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);

  const { hasPermission: hasCamPerm, requestPermission: reqCamPerm } =
    useCameraPermission();
  const { hasPermission: hasMicPerm, requestPermission: reqMicPerm } =
    useMicrophonePermission();

  const [mode, setMode] = useState<CameraMode>(allowedModes[0]);
  const [position, setPosition] = useState<CameraPosition>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordDuration] = useState(0);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [showScreenFlash, setShowScreenFlash] = useState(false);
  const savedBrightnessRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [lastGalleryThumb, setLastGalleryThumb] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const device = useCameraDevice(position);

  const handleCameraInitialized = useCallback(() => {
    console.log("[Camera] Native session initialized");
    setIsCameraReady(true);
  }, []);

  const handleCameraError = useCallback((error: any) => {
    console.error("[Camera] Native error:", error);
  }, []);

  useEffect(() => {
    (async () => {
      const cam = await reqCamPerm();
      const mic = await reqMicPerm();
      setPermissionsReady(cam && mic);
    })();
  }, [reqCamPerm, reqMicPerm]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          const assets = await MediaLibrary.getAssetsAsync({
            first: 1,
            sortBy: [MediaLibrary.SortBy.creationTime],
            mediaType: [
              MediaLibrary.MediaType.photo,
              MediaLibrary.MediaType.video,
            ],
          });
          if (assets.assets.length > 0)
            setLastGalleryThumb(assets.assets[0].uri);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosition((p) => (p === "back" ? "front" : "back"));
  }, []);

  const handleFlash = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));
  }, []);

  const handleToggleMode = useCallback(() => {
    if (allowedModes.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode((m) => (m === "photo" ? "video" : "photo"));
  }, [allowedModes]);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || isTakingPhoto) return;
    setIsTakingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Front camera + flash enabled → Snapchat-style screen glow
    const needsScreenFlash = position === "front" && flash !== "off";
    if (needsScreenFlash) {
      try {
        const current = await Brightness.getBrightnessAsync();
        savedBrightnessRef.current = current;
        await Brightness.setBrightnessAsync(1);
      } catch {}
      setShowScreenFlash(true);
      // Let the bright overlay render + brightness max out
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({
        // Hardware flash only on back camera
        flash:
          position === "back"
            ? flash === "auto"
              ? "auto"
              : flash === "on"
                ? "on"
                : "off"
            : "off",
        enableShutterSound: true,
      });

      // Restore brightness + hide overlay
      if (needsScreenFlash) {
        setShowScreenFlash(false);
        if (savedBrightnessRef.current !== null) {
          await Brightness.setBrightnessAsync(savedBrightnessRef.current);
          savedBrightnessRef.current = null;
        }
      }

      const uri =
        Platform.OS === "android" ? `file://${photo.path}` : photo.path;
      onCapture({
        uri,
        type: "image",
        width: photo.width,
        height: photo.height,
      });
    } catch (e) {
      console.error("[Camera] Photo error:", e);
      // Always restore on error
      setShowScreenFlash(false);
      if (savedBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(savedBrightnessRef.current).catch(
          () => {},
        );
        savedBrightnessRef.current = null;
      }
    } finally {
      setIsTakingPhoto(false);
    }
  }, [flash, isTakingPhoto, onCapture, position]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      await cameraRef.current.stopRecording();
    } catch (e) {
      console.error("[Camera] Stop error:", e);
    }
    setIsRecording(false);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || !device || !isCameraReady) return;
    if (!hasCamPerm || !hasMicPerm) {
      console.warn("[Camera] Missing permissions for recording");
      return;
    }

    setIsRecording(true);
    setRecordDuration(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Small delay to let the native camera session stabilize
    await new Promise((r) => setTimeout(r, 100));

    recordingTimerRef.current = setInterval(() => {
      setRecordDuration((prev) => {
        if (prev + 1 >= maxVideoDuration) stopRecording();
        return prev + 1;
      });
    }, 1000);

    try {
      cameraRef.current.startRecording({
        flash: flash === "on" ? "on" : "off",
        onRecordingFinished: (video: VideoFile) => {
          const uri =
            Platform.OS === "android" ? `file://${video.path}` : video.path;
          onCapture({ uri, type: "video", duration: video.duration });
        },
        onRecordingError: (err) => {
          console.error("[Camera] Recording error:", err);
          setIsRecording(false);
          if (recordingTimerRef.current)
            clearInterval(recordingTimerRef.current);
        },
      });
    } catch (e) {
      console.error("[Camera] Start error:", e);
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  }, [
    flash,
    isRecording,
    maxVideoDuration,
    onCapture,
    stopRecording,
    device,
    hasCamPerm,
    hasMicPerm,
    isCameraReady,
  ]);

  const handleCapture = useCallback(() => {
    if (mode === "photo") handleTakePhoto();
    else if (isRecording) stopRecording();
    else startRecording();
  }, [mode, isRecording, handleTakePhoto, startRecording, stopRecording]);

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Permission screen
  if (!permissionsReady) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.center}>
          <CameraIcon size={48} color="#666" />
          <Text style={s.permText}>Camera & mic access required</Text>
          <Pressable
            onPress={async () => {
              const c = await reqCamPerm();
              const m = await reqMicPerm();
              setPermissionsReady(c && m);
            }}
            style={s.permBtn}
          >
            <Text style={s.permBtnText}>Grant Access</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 16 }}>
            <Text style={{ color: "#999", fontSize: 16 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.permText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Camera */}
      <View style={s.cameraWrap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
          video={true}
          audio={true}
          torch={position === "back" && flash === "on" ? "on" : "off"}
          zoom={zoom}
          enableZoomGesture={true}
          onInitialized={handleCameraInitialized}
          onError={handleCameraError}
        />

        {/* Snapchat-style screen flash for front camera */}
        {showScreenFlash && (
          <Motion.View
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "timing", duration: 100 }}
            style={s.screenFlash}
          />
        )}

        {isRecording && (
          <Motion.View
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={[s.recBadge, { top: insets.top + 16 }]}
          >
            <View style={s.recDot} />
            <Text style={s.recText}>{fmtDur(recordingDuration)}</Text>
            <Text style={s.recMax}>/ {fmtDur(maxVideoDuration)}</Text>
          </Motion.View>
        )}
      </View>

      {/* Top Controls */}
      <View style={[s.topBar, { top: insets.top + 12 }]}>
        <Pressable onPress={onClose} style={s.topBtn} hitSlop={12}>
          <X size={24} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={s.topRight}>
          <Pressable onPress={handleFlash} style={s.topBtn} hitSlop={12}>
            {flash === "off" ? (
              <ZapOff size={22} color="#fff" />
            ) : (
              <View>
                <Zap
                  size={22}
                  color={flash === "auto" ? "#FFD700" : "#fff"}
                  fill={flash === "on" ? "#fff" : "none"}
                />
                {flash === "auto" && <Text style={s.flashA}>A</Text>}
              </View>
            )}
          </Pressable>
          <Pressable onPress={handleFlip} style={s.topBtn} hitSlop={12}>
            <RotateCcw size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Gallery */}
        <View style={s.bottomSide}>
          {showGallery && (
            <Pressable onPress={onGalleryPress} style={s.galleryBtn}>
              {lastGalleryThumb ? (
                <Image
                  source={{ uri: lastGalleryThumb }}
                  style={s.galleryThumb}
                  contentFit="cover"
                />
              ) : (
                <ImageIcon size={24} color="#fff" />
              )}
            </Pressable>
          )}
        </View>

        {/* Capture */}
        <Pressable
          onPress={handleCapture}
          disabled={isTakingPhoto}
          style={s.captureOuter}
        >
          {mode === "photo" ? (
            <View style={s.capturePhoto}>
              {isTakingPhoto && <ActivityIndicator size="small" color="#000" />}
            </View>
          ) : isRecording ? (
            <View style={s.captureRecording}>
              <View style={s.stopSquare} />
            </View>
          ) : (
            <View style={s.captureVideo} />
          )}
        </Pressable>

        {/* Flip (bottom-right) */}
        <View style={s.bottomSide}>
          <Pressable onPress={handleFlip} style={s.flipBtn}>
            <RotateCcw size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Mode Toggle */}
      {allowedModes.length > 1 && !isRecording && (
        <View style={[s.modeBar, { bottom: insets.bottom + 100 }]}>
          {allowedModes.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[s.modeText, mode === m && s.modeActive]}>
                {m === "photo" ? "PHOTO" : "VIDEO"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  permText: { color: "#999", fontSize: 16, textAlign: "center", marginTop: 12 },
  permBtn: {
    backgroundColor: "#3EA4E5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cameraWrap: { flex: 1, borderRadius: 20, overflow: "hidden", margin: 4 },
  recBadge: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  recMax: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: { flexDirection: "row", gap: 10 },
  flashA: {
    position: "absolute",
    bottom: -2,
    right: -2,
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "800",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  bottomSide: { width: 48, alignItems: "center" },
  galleryBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  galleryThumb: { width: "100%", height: "100%" },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  capturePhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureVideo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
  },
  captureRecording: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeBar: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  modeActive: { color: "#fff" },
  screenFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFDE7",
    opacity: 0.92,
    zIndex: 999,
  },
});
