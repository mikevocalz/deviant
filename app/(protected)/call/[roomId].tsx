/**
 * Video Call Screen — Instagram/Snapchat-Style
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  DESIGN:                                                           ║
 * ║  - Remote video fills screen (cover).                              ║
 * ║  - Local video is a small PiP bubble (top-right).                  ║
 * ║  - Controls float at bottom, minimal and clean.                    ║
 * ║  - Role-correct: caller sees "Ringing...", callee sees             ║
 * ║    "Connecting..." — never both as caller.                         ║
 * ║  - Audio mode: avatar-based, no RTCView.                          ║
 * ║                                                                    ║
 * ║  INVARIANTS:                                                       ║
 * ║  1. UI driven by callPhase + callRole from Zustand store.          ║
 * ║  2. RTCView NEVER renders without a resolved video track.          ║
 * ║  3. deriveCallUiMode() is the SINGLE source of UI state.           ║
 * ║  4. PiP uses Fishjam RTCPIPView + startPIP/stopPIP.               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  RTCView,
  RTCPIPView,
  startPIP,
  stopPIP,
} from "@fishjam-cloud/react-native-client";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  AlertTriangle,
  Settings,
  Minimize2,
} from "lucide-react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useVideoCall, type CallType } from "@/lib/hooks/use-video-call";
import { useVideoRoomStore } from "@/src/video/stores/video-room-store";
import { useMediaPermissions } from "@/src/video/hooks/useMediaPermissions";
import { useUIStore } from "@/lib/stores/ui-store";
import { audioSession } from "@/src/services/calls/audioSession";
import { CT } from "@/src/services/calls/callTrace";

const PIP_W = 120;
const PIP_H = 160;

// ── Resolve video track from stream ─────────────────────────────────
function hasVideoTrack(stream: any): boolean {
  if (!stream) return false;
  try {
    const tracks = stream.getVideoTracks?.();
    return tracks && tracks.length > 0;
  } catch {
    return false;
  }
}

// ── Derive UI mode from role + phase — SINGLE source of truth ───────
// REF: Prevents "both are caller" bugs by deriving from server truth.
type CallUiMode =
  | "caller_dialing" // Caller: creating room, connecting
  | "caller_ringing" // Caller: waiting for callee to answer
  | "callee_connecting" // Callee: answered, joining Fishjam
  | "in_call" // Both: connected, media flowing
  | "call_ended" // Both: call ended
  | "error" // Both: error
  | "perms_denied"; // Both: permissions denied

function deriveCallUiMode(p: {
  role: "caller" | "callee";
  phase: string;
}): CallUiMode {
  if (p.phase === "perms_denied") return "perms_denied";
  if (p.phase === "error") return "error";
  if (p.phase === "call_ended") return "call_ended";
  if (p.phase === "connected") return "in_call";
  if (p.role === "caller") {
    if (p.phase === "outgoing_ringing") return "caller_ringing";
    return "caller_dialing";
  }
  return "callee_connecting";
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getStatusLabel(mode: CallUiMode): string {
  switch (mode) {
    case "caller_dialing":
      return "Calling...";
    case "caller_ringing":
      return "Ringing...";
    case "callee_connecting":
      return "Connecting...";
    case "in_call":
      return "";
    case "call_ended":
      return "Call Ended";
    case "error":
      return "Call Failed";
    case "perms_denied":
      return "Permissions Required";
  }
}

// ── Main Screen ─────────────────────────────────────────────────────
export default function VideoCallScreen() {
  const {
    roomId,
    isOutgoing,
    participantIds,
    callType: callTypeParam,
    chatId,
    recipientUsername,
    recipientAvatar,
  } = useLocalSearchParams<{
    roomId?: string;
    isOutgoing?: string;
    participantIds?: string;
    callType?: string;
    chatId?: string;
    recipientUsername?: string;
    recipientAvatar?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const muteDebounceRef = useRef(false);
  const pipViewRef = useRef<any>(null);

  const { requestPermissions, openSettings } = useMediaPermissions();

  const {
    callPhase,
    callType,
    callRole,
    isInCall,
    localStream,
    participants,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    isPiPActive,
    callEnded,
    callDuration,
    error,
    errorCode,
    micPermission,
    isAudioMode,
    createCall,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    escalateToVideo,
    switchCamera,
    resetCallEnded,
  } = useVideoCall();

  const storeRoomId = useVideoRoomStore((s) => s.roomId);
  const setSpeakerOn = useVideoRoomStore((s) => s.setSpeakerOn);
  const setIsPiPActive = useVideoRoomStore((s) => s.setIsPiPActive);

  const initialCallType: CallType =
    callTypeParam === "audio" ? "audio" : "video";

  // ── Derive UI mode — SINGLE source of truth ───────────────────────
  const uiMode = deriveCallUiMode({ role: callRole, phase: callPhase });
  const statusLabel = getStatusLabel(uiMode);
  const isPreCall =
    uiMode === "caller_dialing" ||
    uiMode === "caller_ringing" ||
    uiMode === "callee_connecting";

  // ── Remote participant (first remote peer for 1:1) ────────────────
  const remotePeer = participants[0] ?? null;
  const remoteVideoStream = remotePeer?.videoTrack?.stream ?? null;
  const hasRemoteVideo =
    hasVideoTrack(remoteVideoStream) && remotePeer?.isCameraOn;
  const hasLocalVideo = hasVideoTrack(localStream) && !isVideoOff;

  // ── DETERMINISTIC INIT: perms → room → peer → media ───────────────
  useEffect(() => {
    const initCall = async () => {
      const permsOk = await requestPermissions(initialCallType);
      if (!permsOk) {
        CT.error("LIFECYCLE", "permsDenied", { callType: initialCallType });
        return;
      }
      if (isOutgoing === "true" && participantIds) {
        const ids = participantIds.split(",");
        await createCall(ids, ids.length > 1, initialCallType, chatId);
      } else if (roomId) {
        await joinCall(roomId, initialCallType);
      }
    };
    initCall();
  }, [roomId, isOutgoing, participantIds]);

  // ── Auto-dismiss call ended ───────────────────────────────────────
  const handleDismissCallEnded = useCallback(() => {
    resetCallEnded();
    router.back();
  }, [resetCallEnded, router]);

  useEffect(() => {
    if (callEnded) {
      const timer = setTimeout(handleDismissCallEnded, 1500);
      return () => clearTimeout(timer);
    }
  }, [callEnded, handleDismissCallEnded]);

  // ── PiP: auto-enter on background for video calls ─────────────────
  // REF: https://docs.fishjam.io/next/how-to/react-native/picture-in-picture
  useEffect(() => {
    if (isAudioMode || uiMode !== "in_call") return;
    const sub = AppState.addEventListener("change", (nextState) => {
      CT.guard("VIDEO", "appStateChange_pip", () => {
        if (nextState === "background" && !isPiPActive && pipViewRef.current) {
          startPIP(pipViewRef);
          setIsPiPActive(true);
          CT.trace("VIDEO", "pipEntered_auto");
        } else if (
          nextState === "active" &&
          isPiPActive &&
          pipViewRef.current
        ) {
          stopPIP(pipViewRef);
          setIsPiPActive(false);
          CT.trace("VIDEO", "pipExited_foreground");
        }
      });
    });
    return () => sub.remove();
  }, [isAudioMode, uiMode, isPiPActive, setIsPiPActive]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (isPiPActive) {
      CT.guard("VIDEO", "stopPIP_onEnd", () => {
        if (pipViewRef.current) stopPIP(pipViewRef);
      });
      setIsPiPActive(false);
    }
    leaveCall();
  }, [leaveCall, isPiPActive, setIsPiPActive]);

  const handleToggleMute = useCallback(() => {
    if (muteDebounceRef.current) return;
    muteDebounceRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
    setTimeout(() => {
      muteDebounceRef.current = false;
    }, 300);
  }, [toggleMute]);

  const handleToggleSpeaker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newState = !isSpeakerOn;
    audioSession.setSpeakerOn(newState);
    setSpeakerOn(newState);
  }, [isSpeakerOn, setSpeakerOn]);

  const handleToggleVideo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleVideo();
  }, [toggleVideo]);

  const handleEscalateToVideo = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await escalateToVideo();
    if (!ok) {
      showToast(
        "error",
        "Camera Unavailable",
        "Could not enable camera. Check permissions in Settings.",
      );
    }
  }, [escalateToVideo, showToast]);

  const handleSwitchCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchCamera();
  }, [switchCamera]);

  const handleTogglePiP = useCallback(() => {
    // REF: https://docs.fishjam.io/next/how-to/react-native/picture-in-picture
    CT.guard("VIDEO", "togglePiP", () => {
      if (isPiPActive) {
        if (pipViewRef.current) stopPIP(pipViewRef);
        setIsPiPActive(false);
        CT.trace("VIDEO", "pipExited_manual");
      } else {
        if (pipViewRef.current) startPIP(pipViewRef);
        setIsPiPActive(true);
        CT.trace("VIDEO", "pipEntered_manual");
      }
    });
  }, [isPiPActive, setIsPiPActive]);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE-BASED RENDERING
  // ═══════════════════════════════════════════════════════════════════

  // ── Permission Denied ─────────────────────────────────────────────
  if (uiMode === "perms_denied") {
    return (
      <View
        className="flex-1 bg-black items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-amber-500/20 items-center justify-center">
            <AlertTriangle size={36} color="#F59E0B" />
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Permissions Required
          </Text>
          <Text className="text-white/60 text-base text-center">
            {micPermission === "denied"
              ? "Microphone access is required for calls."
              : "Camera access is required for video calls."}
          </Text>
          <Pressable
            className="mt-4 px-8 py-3 bg-primary rounded-full flex-row items-center gap-2"
            onPress={openSettings}
          >
            <Settings size={18} color="#fff" />
            <Text className="text-white text-base font-medium">
              Open Settings
            </Text>
          </Pressable>
          <Pressable className="mt-2 px-8 py-3" onPress={() => router.back()}>
            <Text className="text-white/60 text-base">Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  if (uiMode === "error") {
    return (
      <View
        className="flex-1 bg-black items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-red-500/20 items-center justify-center">
            <AlertTriangle size={36} color="#FF3B30" />
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Call Failed
          </Text>
          <Text className="text-white/60 text-base text-center">
            {error || "An unexpected error occurred"}
          </Text>
          {errorCode && (
            <Text className="text-white/30 text-xs font-mono">{errorCode}</Text>
          )}
          <Pressable
            className="mt-4 px-8 py-3 bg-white/10 rounded-full"
            onPress={() => {
              leaveCall();
              resetCallEnded();
              router.back();
            }}
          >
            <Text className="text-white text-base font-medium">Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Call Ended ─────────────────────────────────────────────────────
  if (uiMode === "call_ended" || callEnded) {
    return (
      <View
        className="flex-1 bg-black items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-red-500/20 items-center justify-center">
            <PhoneOff size={36} color="#FF3B30" />
          </View>
          <Text className="text-white text-2xl font-bold">Call Ended</Text>
          {callDuration > 0 && (
            <Text className="text-white/60 text-base">
              {formatDuration(callDuration)}
            </Text>
          )}
          <Pressable
            className="mt-6 px-8 py-3 bg-white/10 rounded-full"
            onPress={handleDismissCallEnded}
          >
            <Text className="text-white text-base font-medium">
              Back to Chat
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTIVE CALL UI — Instagram/Snapchat Style
  // ═══════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-black">
      {/* ── REMOTE STAGE (fullscreen) ──────────────────────────────── */}
      {isAudioMode ? (
        // AUDIO MODE: centered avatar + name
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-4">
            {recipientAvatar ? (
              <Image
                source={{ uri: recipientAvatar }}
                style={styles.avatarLarge}
              />
            ) : (
              <View style={[styles.avatarLarge, styles.avatarPlaceholder]}>
                <Text className="text-white text-4xl font-bold">
                  {(recipientUsername || remotePeer?.username || "?")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="text-white text-xl font-semibold">
              {recipientUsername || remotePeer?.username || "Unknown"}
            </Text>
            {statusLabel ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white/70 text-base">{statusLabel}</Text>
              </View>
            ) : callDuration > 0 ? (
              <Text className="text-white/50 text-lg font-mono">
                {formatDuration(callDuration)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        // VIDEO MODE: fullscreen remote video or avatar placeholder
        <View style={StyleSheet.absoluteFill}>
          {hasRemoteVideo && remoteVideoStream ? (
            // REF: https://docs.fishjam.io/tutorials/react-native-quick-start
            // Use RTCPIPView for PiP support per Fishjam docs
            // REF: https://docs.fishjam.io/next/how-to/react-native/picture-in-picture
            <RTCPIPView
              ref={pipViewRef}
              mediaStream={remoteVideoStream}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
            />
          ) : (
            // No remote video yet — show avatar centered on black
            <View className="flex-1 items-center justify-center bg-black">
              {recipientAvatar ? (
                <Image
                  source={{ uri: recipientAvatar }}
                  style={styles.avatarLarge}
                />
              ) : (
                <View style={[styles.avatarLarge, styles.avatarPlaceholder]}>
                  <Text className="text-white text-4xl font-bold">
                    {(recipientUsername || remotePeer?.username || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              <Text className="text-white text-xl font-semibold mt-4">
                {recipientUsername || remotePeer?.username || "Unknown"}
              </Text>
            </View>
          )}

          {/* ── LOCAL PiP BUBBLE (top-right) ─────────────────────── */}
          {hasLocalVideo && localStream && (
            <View
              style={[styles.pipBubble, { top: insets.top + 12, right: 12 }]}
            >
              <RTCView
                mediaStream={localStream}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror={true}
              />
            </View>
          )}
        </View>
      )}

      {/* ── STATUS OVERLAY (role-correct) ─────────────────────────── */}
      {isPreCall && (
        <View
          className="absolute top-0 left-0 right-0 items-center"
          style={{ top: insets.top + 16 }}
        >
          <View className="bg-black/60 px-5 py-2.5 rounded-full flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#fff" />
            <Text className="text-white text-sm font-medium">
              {statusLabel}
            </Text>
          </View>
        </View>
      )}

      {/* ── DURATION (in-call only) ───────────────────────────────── */}
      {uiMode === "in_call" && callDuration > 0 && !isAudioMode && (
        <View
          className="absolute items-center"
          style={{ top: insets.top + 8, left: 0, right: 0 }}
        >
          <View className="bg-black/50 px-4 py-1 rounded-full">
            <Text className="text-white/80 text-sm font-mono">
              {formatDuration(callDuration)}
            </Text>
          </View>
        </View>
      )}

      {/* ── DEV HUD ──────────────────────────────────────────────── */}
      {__DEV__ && (
        <View className="absolute left-2" style={{ top: insets.top + 44 }}>
          <View className="bg-black/70 px-2 py-1 rounded">
            <Text className="text-green-400 text-[10px] font-mono">
              {callRole}/{callPhase} | rem={participants.length} | spk=
              {isSpeakerOn ? "Y" : "N"} | mic={isMuted ? "OFF" : "ON"}
              {!isAudioMode &&
                ` | vid=${hasLocalVideo ? "Y" : "N"} | rVid=${hasRemoteVideo ? "Y" : "N"}`}
            </Text>
            <Text className="text-yellow-400 text-[10px] font-mono">
              audio={audioSession.getState().isActive ? "ON" : "OFF"} | rAud=
              {remotePeer?.isMicOn ? "Y" : "N"} | hwMute=
              {audioSession.getState().isMicMuted ? "Y" : "N"}
            </Text>
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FLOATING CONTROLS — Instagram/Snapchat style
          ═══════════════════════════════════════════════════════════ */}
      <View
        className="absolute left-4 right-4 flex-row items-center justify-center gap-3 px-4 py-3"
        style={{ bottom: insets.bottom + 20 }}
      >
        {/* Mute */}
        <Pressable
          className={`w-14 h-14 rounded-full items-center justify-center ${isMuted ? "bg-red-500" : "bg-white/20"}`}
          onPress={handleToggleMute}
        >
          {isMuted ? (
            <MicOff size={24} color="#fff" />
          ) : (
            <Mic size={24} color="#fff" />
          )}
        </Pressable>

        {/* Speaker */}
        <Pressable
          className={`w-14 h-14 rounded-full items-center justify-center ${isSpeakerOn ? "bg-white/30" : "bg-white/10"}`}
          onPress={handleToggleSpeaker}
        >
          {isSpeakerOn ? (
            <Volume2 size={24} color="#fff" />
          ) : (
            <VolumeX size={24} color="rgba(255,255,255,0.5)" />
          )}
        </Pressable>

        {isAudioMode ? (
          // Audio: escalate to video
          <Pressable
            className="w-14 h-14 rounded-full items-center justify-center bg-white/10"
            onPress={handleEscalateToVideo}
          >
            <Video size={24} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : (
          // Video: camera toggle + flip + PiP
          <>
            <Pressable
              className="w-14 h-14 rounded-full items-center justify-center bg-white/20"
              onPress={handleToggleVideo}
            >
              {isVideoOff ? (
                <VideoOff size={24} color="rgba(255,255,255,0.5)" />
              ) : (
                <Video size={24} color="#fff" />
              )}
            </Pressable>
            {!isVideoOff && (
              <Pressable
                className="w-14 h-14 rounded-full items-center justify-center bg-white/20"
                onPress={handleSwitchCamera}
              >
                <SwitchCamera size={24} color="#fff" />
              </Pressable>
            )}
            {/* PiP button — video calls only */}
            {uiMode === "in_call" && (
              <Pressable
                className="w-14 h-14 rounded-full items-center justify-center bg-white/10"
                onPress={handleTogglePiP}
              >
                <Minimize2 size={22} color="#fff" />
              </Pressable>
            )}
          </>
        )}

        {/* End call */}
        <Pressable
          className="w-16 h-16 rounded-full items-center justify-center bg-red-500"
          onPress={handleEndCall}
        >
          <PhoneOff size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  pipBubble: {
    position: "absolute",
    width: PIP_W,
    height: PIP_H,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
