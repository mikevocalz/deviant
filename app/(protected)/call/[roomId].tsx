/**
 * Video Call Screen — Production-Grade
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ARCHITECTURE INVARIANTS:                                          ║
 * ║                                                                    ║
 * ║  1. UI is driven by callPhase from Zustand store.                  ║
 * ║  2. RTCView NEVER renders without a resolved video track.          ║
 * ║  3. Permission denial shows explicit UI with Settings link.        ║
 * ║  4. Errors show explicit UI — no silent failures.                  ║
 * ║  5. Only useState allowed: showParticipants (local UI toggle).     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RTCView } from "@fishjam-cloud/react-native-client";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  UserPlus,
  X,
  SwitchCamera,
  Volume2,
  AlertTriangle,
  Settings,
} from "lucide-react-native";
import { Image } from "expo-image";
import { Motion, AnimatePresence } from "@legendapp/motion";
import * as Haptics from "expo-haptics";
import { useVideoCall, type CallType } from "@/lib/hooks/use-video-call";
import { useMediaPermissions } from "@/src/video/hooks/useMediaPermissions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Grid layout helper ──────────────────────────────────────────────
function getGridLayout(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

// ── Hardened Video Tile ─────────────────────────────────────────────
// INVARIANT: RTCView NEVER renders without a resolved video track.
function VideoTile({
  stream,
  isVideoOff,
  isMuted,
  isSpeaker,
  label,
  avatar,
  mirror,
  width,
  height,
}: {
  stream?: any;
  isVideoOff: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  label: string;
  avatar?: string;
  mirror?: boolean;
  width: number;
  height: number;
}) {
  // HARD GUARD: Only render RTCView if we have a stream with at least one video track
  const hasResolvedVideoTrack = (() => {
    if (!stream || isVideoOff) return false;
    try {
      const videoTracks = stream.getVideoTracks?.();
      return videoTracks && videoTracks.length > 0;
    } catch {
      return false;
    }
  })();

  return (
    <View
      className={`rounded-2xl overflow-hidden bg-card relative ${
        isSpeaker ? "border-2 border-primary" : "border border-border/30"
      }`}
      style={{ width, height, margin: 4 }}
    >
      {hasResolvedVideoTrack ? (
        <RTCView
          mediaStream={stream}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={mirror}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-card">
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-3xl font-bold">
                {label.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Name pill */}
      <View className="absolute bottom-2 left-2 flex-row items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
        <Text className="text-white text-xs font-medium">{label}</Text>
        {isMuted && <MicOff size={12} color="rgba(255,255,255,0.7)" />}
      </View>

      {/* Speaker indicator */}
      {isSpeaker && (
        <View className="absolute top-2 right-2 bg-primary/80 p-1 rounded-md">
          <Volume2 size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ── Phase label for connecting states ────────────────────────────────
function getPhaseLabel(phase: string): string {
  switch (phase) {
    case "requesting_perms":
      return "Requesting permissions...";
    case "creating_room":
      return "Creating call...";
    case "joining_room":
      return "Joining call...";
    case "connecting_peer":
      return "Connecting...";
    case "starting_media":
      return "Starting camera...";
    default:
      return "Connecting...";
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
  } = useLocalSearchParams<{
    roomId?: string;
    isOutgoing?: string;
    participantIds?: string;
    callType?: string;
    chatId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  // Only local UI state allowed
  const [showParticipants, setShowParticipants] = useState(false);

  // Permission hook (strict state machine)
  const { requestPermissions, openSettings } = useMediaPermissions();

  const {
    callPhase,
    callType,
    isConnected,
    isInCall,
    localStream,
    participants,
    isMuted,
    isVideoOff,
    callEnded,
    callDuration,
    error,
    errorCode,
    cameraPermission,
    micPermission,
    createCall,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    resetCallEnded,
  } = useVideoCall();

  const initialCallType: CallType =
    callTypeParam === "audio" ? "audio" : "video";

  // ── DETERMINISTIC INIT: perms → room → peer → media ───────────────
  useEffect(() => {
    const initCall = async () => {
      // Step 0: Request permissions (BLOCKS until resolved)
      const permsOk = await requestPermissions(initialCallType);
      if (!permsOk) {
        console.error("[CallScreen] Permissions denied, cannot proceed");
        return;
      }

      // Step 1+: Create or join call (hook handles the rest)
      if (isOutgoing === "true" && participantIds) {
        const ids = participantIds.split(",");
        await createCall(ids, ids.length > 1, initialCallType, chatId);
      } else if (roomId) {
        await joinCall(roomId, initialCallType);
      }
    };

    initCall();
  }, [roomId, isOutgoing, participantIds]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    leaveCall();
  }, [leaveCall]);

  const handleDismissCallEnded = useCallback(() => {
    resetCallEnded();
    router.back();
  }, [resetCallEnded, router]);

  useEffect(() => {
    if (callEnded) {
      const timer = setTimeout(handleDismissCallEnded, 3000);
      return () => clearTimeout(timer);
    }
  }, [callEnded, handleDismissCallEnded]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  const handleToggleVideo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleVideo();
  }, [toggleVideo]);

  const handleSwitchCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchCamera();
  }, [switchCamera]);

  // Grid dimensions
  const totalParticipants = participants.length + 1;
  const { cols, rows } = getGridLayout(totalParticipants);
  const tileWidth = (SCREEN_WIDTH - 24) / cols;
  const tileHeight = (SCREEN_HEIGHT - 200) / rows;

  // ═══════════════════════════════════════════════════════════════════
  // PHASE-BASED RENDERING — every phase has explicit UI
  // ═══════════════════════════════════════════════════════════════════

  // ── Permission Denied UI ──────────────────────────────────────────
  if (callPhase === "perms_denied") {
    return (
      <View
        className="flex-1 bg-background items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-amber-500/20 items-center justify-center">
            <AlertTriangle size={36} color="#F59E0B" />
          </View>
          <Text className="text-foreground text-2xl font-bold text-center">
            Permissions Required
          </Text>
          <Text className="text-muted-foreground text-base text-center">
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
            <Text className="text-muted-foreground text-base">Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Error UI ──────────────────────────────────────────────────────
  if (callPhase === "error") {
    return (
      <View
        className="flex-1 bg-background items-center justify-center px-8"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-destructive/20 items-center justify-center">
            <AlertTriangle size={36} color="#FF3B30" />
          </View>
          <Text className="text-foreground text-2xl font-bold text-center">
            Call Failed
          </Text>
          <Text className="text-muted-foreground text-base text-center">
            {error || "An unexpected error occurred"}
          </Text>
          {errorCode && (
            <Text className="text-muted-foreground/50 text-xs font-mono">
              {errorCode}
            </Text>
          )}
          <Pressable
            className="mt-4 px-8 py-3 bg-card rounded-full border border-border"
            onPress={() => {
              resetCallEnded();
              router.back();
            }}
          >
            <Text className="text-foreground text-base font-medium">
              Go Back
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Call Ended UI ─────────────────────────────────────────────────
  if (callPhase === "call_ended" || callEnded) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-destructive/20 items-center justify-center">
            <PhoneOff size={36} color="#FF3B30" />
          </View>
          <Text className="text-foreground text-2xl font-bold">Call Ended</Text>
          {callDuration > 0 && (
            <Text className="text-muted-foreground text-base">
              {formatDuration(callDuration)}
            </Text>
          )}
          <Pressable
            className="mt-6 px-8 py-3 bg-card rounded-full border border-border"
            onPress={handleDismissCallEnded}
          >
            <Text className="text-foreground text-base font-medium">
              Back to Chat
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Connecting phases UI ──────────────────────────────────────────
  const isConnecting = [
    "idle",
    "requesting_perms",
    "creating_room",
    "joining_room",
    "connecting_peer",
    "starting_media",
  ].includes(callPhase);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Phase indicator for connecting states */}
      {isConnecting && (
        <View className="absolute top-16 left-0 right-0 z-50 items-center">
          <View className="bg-card/90 px-5 py-2.5 rounded-full border border-border/30 flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#3EA4E5" />
            <Text className="text-foreground text-sm font-medium">
              {getPhaseLabel(callPhase)}
            </Text>
          </View>
        </View>
      )}

      {/* Call Duration */}
      {isInCall && callDuration > 0 && (
        <View className="absolute top-4 left-0 right-0 z-40 items-center">
          <View className="bg-card/80 px-4 py-1.5 rounded-full border border-border/30">
            <Text className="text-muted-foreground text-sm font-medium">
              {formatDuration(callDuration)}
            </Text>
          </View>
        </View>
      )}

      {/* Video Grid / Audio UI */}
      {callType === "audio" && isVideoOff ? (
        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center gap-4">
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                className="w-28 h-28 rounded-full border-2 border-primary"
              />
            ) : (
              <View className="w-28 h-28 rounded-full bg-primary items-center justify-center">
                <Text className="text-white text-4xl font-bold">
                  {user?.username?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <Text className="text-foreground text-xl font-semibold">
              {participants.length > 0
                ? participants.map((p) => p.username).join(", ")
                : "Calling..."}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {isInCall ? "Audio Call" : "Connecting..."}
            </Text>
          </View>

          {participants.length > 0 && (
            <View className="flex-row gap-4 mt-4">
              {participants.map((p) => (
                <View key={p.oderId} className="items-center gap-2">
                  <View className="w-16 h-16 rounded-full bg-card items-center justify-center border border-border">
                    <Text className="text-foreground text-xl font-bold">
                      {p.username?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {p.username}
                  </Text>
                  {!p.isMicOn && (
                    <MicOff size={12} color="rgba(255,255,255,0.4)" />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="flex-1 flex-row flex-wrap justify-center items-center p-2">
          <VideoTile
            stream={localStream}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            isSpeaker={false}
            label="You"
            avatar={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${user?.username}&background=1a1a1a&color=fff`
            }
            mirror={true}
            width={tileWidth - 8}
            height={tileHeight - 8}
          />

          {participants.map((p) => (
            <VideoTile
              key={p.oderId}
              stream={p.videoTrack?.stream}
              isVideoOff={!p.isCameraOn}
              isMuted={!p.isMicOn}
              isSpeaker={false}
              label={p.username || "?"}
              avatar={p.avatar}
              width={tileWidth - 8}
              height={tileHeight - 8}
            />
          ))}
        </View>
      )}

      {/* Floating Controls Bar */}
      <View
        className="absolute left-4 right-4 flex-row items-center justify-center gap-4 px-6 py-4 bg-card/90 rounded-full border border-border/50"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Pressable
          className={`w-12 h-12 rounded-full items-center justify-center ${
            isMuted ? "bg-destructive" : "bg-muted/80"
          }`}
          onPress={handleToggleMute}
        >
          {isMuted ? (
            <MicOff size={22} color="#fff" />
          ) : (
            <Mic size={22} color="#fff" />
          )}
        </Pressable>

        <Pressable
          className="w-12 h-12 rounded-full items-center justify-center bg-muted/80"
          onPress={handleToggleVideo}
        >
          {isVideoOff ? (
            <VideoOff size={22} color="rgba(255,255,255,0.5)" />
          ) : (
            <Video size={22} color="#fff" />
          )}
        </Pressable>

        {!isVideoOff && (
          <Pressable
            className="w-12 h-12 rounded-full items-center justify-center bg-muted/80"
            onPress={handleSwitchCamera}
          >
            <SwitchCamera size={22} color="#fff" />
          </Pressable>
        )}

        <Pressable
          className="w-12 h-12 rounded-full items-center justify-center bg-muted/80 relative"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowParticipants(true);
          }}
        >
          <Users size={22} color="#fff" />
          {participants.length > 0 && (
            <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-[10px] font-bold">
                {participants.length + 1}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          className="w-14 h-14 rounded-full items-center justify-center bg-destructive"
          onPress={handleEndCall}
        >
          <PhoneOff size={26} color="#fff" />
        </Pressable>
      </View>

      {/* Participants Bottom Sheet */}
      <AnimatePresence>
        {showParticipants && (
          <>
            <Pressable
              className="absolute inset-0 bg-black/60"
              onPress={() => setShowParticipants(false)}
            />
            <Motion.View
              initial={{ translateY: 400 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 400 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border"
              style={{
                maxHeight: SCREEN_HEIGHT * 0.6,
                paddingBottom: insets.bottom,
              }}
            >
              <View className="w-10 h-1 rounded-full bg-muted-foreground/30 self-center mt-3 mb-2" />
              <View className="flex-row justify-between items-center px-5 pb-3 border-b border-border">
                <Text className="text-foreground text-lg font-semibold">
                  Participants ({participants.length + 1})
                </Text>
                <Pressable
                  onPress={() => setShowParticipants(false)}
                  hitSlop={12}
                >
                  <X size={22} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              <ScrollView className="max-h-[300px]">
                <View className="flex-row items-center px-5 py-3 gap-3">
                  <Image
                    source={{
                      uri:
                        user?.avatar ||
                        `https://ui-avatars.com/api/?name=${user?.username}&background=1a1a1a&color=fff`,
                    }}
                    className="w-11 h-11 rounded-full"
                  />
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-medium">
                      You
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {isMuted && (
                      <MicOff size={16} color="rgba(255,255,255,0.3)" />
                    )}
                    {isVideoOff && (
                      <VideoOff size={16} color="rgba(255,255,255,0.3)" />
                    )}
                  </View>
                </View>

                {participants.map((p) => (
                  <View
                    key={p.oderId}
                    className="flex-row items-center px-5 py-3 gap-3"
                  >
                    <View className="w-11 h-11 rounded-full bg-primary items-center justify-center">
                      <Text className="text-white text-lg font-bold">
                        {p.username?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-base font-medium">
                        {p.username}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      {!p.isMicOn && (
                        <MicOff size={16} color="rgba(255,255,255,0.3)" />
                      )}
                      {!p.isCameraOn && (
                        <VideoOff size={16} color="rgba(255,255,255,0.3)" />
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <Pressable
                className="flex-row items-center justify-center gap-2 py-4 border-t border-border active:bg-muted/50"
                onPress={() =>
                  showToast(
                    "info",
                    "Coming Soon",
                    "Add participant feature coming soon",
                  )
                }
              >
                <UserPlus size={20} color="#FC253A" />
                <Text className="text-primary text-base font-medium">
                  Add participant
                </Text>
              </Pressable>
            </Motion.View>
          </>
        )}
      </AnimatePresence>
    </View>
  );
}
