/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 * Uses Fishjam for real audio/video — no mock data
 *
 * ARCHITECTURE: Two separate components to avoid useVideoRoom's internal
 * useCamera() from interfering with the shared Fishjam camera context.
 * - LocalRoom: uses useCamera/useMicrophone directly (no useVideoRoom)
 * - ServerRoom: uses useVideoRoom for full Fishjam room management
 */

import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  MoreHorizontal,
  Users,
  EyeOff,
  Radio,
  Mic,
  MicOff,
} from "lucide-react-native";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  useCameraPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";
import { useCamera, useMicrophone } from "@fishjam-cloud/react-native-client";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  VideoStage,
  VideoGrid,
  ParticipantActions,
  SpeakerGrid,
  ListenerGrid,
  ControlsBar,
  ConnectionBanner,
  EjectModal,
  ChatSheet,
  RoomTimer,
} from "@/src/sneaky-lynk/ui";
import type { VideoParticipant } from "@/src/sneaky-lynk/ui";
import type { SneakyUser } from "@/src/sneaky-lynk/types";
import { videoApi } from "@/src/video/api";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRoomStore } from "@/src/sneaky-lynk/stores/room-store";
import { useLynkHistoryStore } from "@/src/sneaky-lynk/stores/lynk-history-store";
import { sneakyLynkApi } from "@/src/sneaky-lynk/api/supabase";
import { audioSession } from "@/src/services/calls/audioSession";

// ── Error Boundary (per-route) — surfaces real crash message ────────

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#EF4444",
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 12,
        }}
      >
        Room Error
      </Text>
      <Text
        style={{
          color: "#9CA3AF",
          fontSize: 13,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {error.message}
      </Text>
      <ScrollView style={{ maxHeight: 200, width: "100%", marginBottom: 16 }}>
        <Text
          style={{ color: "#6B7280", fontSize: 10, fontFamily: "monospace" }}
        >
          {error.stack}
        </Text>
      </ScrollView>
      <Pressable
        onPress={retry}
        style={{
          backgroundColor: "#FC253A",
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────

function buildLocalUser(authUser: any): SneakyUser {
  return {
    id: authUser?.id || "local",
    username: authUser?.username || "You",
    displayName: authUser?.name || authUser?.username || "You",
    avatar: authUser?.avatar || "",
    isVerified: authUser?.isVerified || false,
  };
}

// ── Pre-Join Screen ──────────────────────────────────────────────────

function PreJoinScreen({
  roomTitle,
  onJoin,
  onBack,
}: {
  roomTitle: string;
  onJoin: (anonymous: boolean) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [anonymous, setAnonymous] = React.useState(false);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={onBack} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text
            className="text-foreground font-semibold text-center"
            numberOfLines={1}
          >
            {roomTitle || "Join Lynk"}
          </Text>
        </View>
        <View className="w-6" />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6">
          <Radio size={40} color="#FC253A" />
        </View>

        <Text className="text-2xl font-bold text-foreground text-center mb-2">
          {roomTitle || "Sneaky Lynk"}
        </Text>
        <Text className="text-muted-foreground text-center mb-10">
          Choose how you want to appear in this room
        </Text>

        {/* Anonymous Toggle */}
        <View className="w-full bg-secondary rounded-2xl px-5 py-4 mb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                <EyeOff size={20} color="#FC253A" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  Join Anonymously
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  You&apos;ll appear as &quot;ANON LYNK&quot; with no profile
                  info
                </Text>
              </View>
            </View>
            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: "#374151", true: "#FC253A" }}
              thumbColor="#fff"
            />
          </View>

          {anonymous && (
            <View className="mt-3 pt-3 border-t border-border/50">
              <Text className="text-xs text-muted-foreground">
                Your identity will be hidden from other participants. The host
                and moderators cannot see who you are.
              </Text>
            </View>
          )}
        </View>

        {/* Join Button */}
        <Pressable
          onPress={() => onJoin(anonymous)}
          className="w-full py-4 rounded-full bg-primary items-center active:bg-primary/80"
        >
          <Text className="text-white font-bold text-base">
            {anonymous ? "Join Anonymously" : "Join Lynk"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Router entry point ──────────────────────────────────────────────

export default function SneakyLynkRoomScreen() {
  const {
    id,
    title: paramTitle,
    hasVideo: hasVideoParam,
    isHost: isHostParam,
  } = useLocalSearchParams<{
    id: string;
    title?: string;
    hasVideo?: string;
    isHost?: string;
  }>();
  const router = useRouter();

  const roomHasVideo = hasVideoParam === "1";
  const isServerRoom = !id?.startsWith("space-") && id !== "my-room";

  // Host (creator) skips the pre-join screen entirely
  const isCreator = isHostParam === "1";
  // Pre-join state for server rooms (joiners, not creators)
  const [hasJoined, setHasJoined] = useState(!isServerRoom || isCreator);
  const [joinAnonymous, setJoinAnonymous] = useState(false);

  const handleJoin = useCallback((anonymous: boolean) => {
    setJoinAnonymous(anonymous);
    setHasJoined(true);
  }, []);

  // Show pre-join screen for server rooms
  if (isServerRoom && !hasJoined) {
    return (
      <PreJoinScreen
        roomTitle={paramTitle || "Sneaky Lynk"}
        onJoin={handleJoin}
        onBack={() => router.back()}
      />
    );
  }

  if (isServerRoom) {
    return (
      <ServerRoom
        id={id}
        paramTitle={paramTitle}
        roomHasVideo={roomHasVideo}
        anonymous={joinAnonymous}
      />
    );
  }
  return (
    <LocalRoom id={id} paramTitle={paramTitle} roomHasVideo={roomHasVideo} />
  );
}

// ── LocalRoom: direct Fishjam camera/mic, NO useVideoRoom ──────────

function LocalRoom({
  id,
  paramTitle,
  roomHasVideo = true,
}: {
  id: string;
  paramTitle?: string;
  roomHasVideo?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const fishjamCamera = useCamera();
  const fishjamMic = useMicrophone();
  const endRoom = useLynkHistoryStore((s) => s.endRoom);

  // VisionCamera permissions for native camera preview
  const {
    hasPermission: hasCamPermission,
    requestPermission: requestCamPermission,
  } = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  // Keep refs to the latest camera/mic so effects never use stale closures.
  const cameraRef = useRef(fishjamCamera);
  const micRef = useRef(fishjamMic);
  useEffect(() => {
    cameraRef.current = fishjamCamera;
  }, [fishjamCamera]);
  useEffect(() => {
    micRef.current = fishjamMic;
  }, [fishjamMic]);

  const {
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    connectionState: storeConnectionState,
    coHost: storeCoHost,
    listeners: storeListeners,
    toggleHand,
    setActiveSpeakerId,
    openChat,
    closeChat,
    hideEject,
    promoteListener,
    reset,
  } = useRoomStore();

  // Local video on/off state (CameraView doesn't have isCameraOn)
  const [localVideoOn, setLocalVideoOn] = React.useState(roomHasVideo);

  const localUser = buildLocalUser(authUser);
  const effectiveMuted = !fishjamMic.isMicrophoneOn;
  const effectiveVideoOn = localVideoOn && hasCamPermission;

  // Reset store on mount, request permissions
  useEffect(() => {
    reset();
    requestCamPermission();
    requestMicPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start audio session + mic on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Configure audio session BEFORE starting mic (no CallKit for Lynk rooms)
        audioSession.startForLynk(roomHasVideo);
        console.log("[SneakyLynk:Local] Starting mic");
        await micRef.current.startMicrophone();
        if (!cancelled) console.log("[SneakyLynk:Local] Mic started");
      } catch (e) {
        console.warn("[SneakyLynk:Local] Failed to start mic:", e);
      }
    })();
    return () => {
      cancelled = true;
      micRef.current.stopMicrophone();
      audioSession.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speaking indicator
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
    } else {
      setActiveSpeakerId(localUser.id);
    }
  }, [effectiveMuted, localUser.id, setActiveSpeakerId]);

  const handleLeave = useCallback(async () => {
    // Local rooms are always hosted by the creator — end in DB too
    try {
      await sneakyLynkApi.endRoom(id);
      console.log("[SneakyLynk:Local] Room ended in DB:", id);
    } catch (e) {
      // Non-fatal: room may not exist in DB (legacy local-only rooms)
      console.warn("[SneakyLynk:Local] Failed to end room in DB:", e);
    }
    endRoom(id, storeListeners.length);
    router.back();
  }, [router, id, endRoom, storeListeners.length]);
  const handleToggleMic = useCallback(async () => {
    if (micRef.current.isMicrophoneOn) micRef.current.stopMicrophone();
    else await micRef.current.startMicrophone();
  }, []);
  const handleToggleVideo = useCallback(() => {
    setLocalVideoOn((prev) => !prev);
  }, []);
  const handleToggleHand = useCallback(() => toggleHand(), [toggleHand]);
  const handleChat = useCallback(() => openChat(), [openChat]);
  const handleCloseChat = useCallback(() => closeChat(), [closeChat]);
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  const roomTitle = paramTitle || "Sneaky Lynk";

  // Build flat VideoParticipant[] for VideoGrid
  const allParticipants: VideoParticipant[] = [];

  // Local user (host)
  allParticipants.push({
    id: localUser.id,
    user: localUser,
    role: "host",
    isLocal: true,
    isCameraOn: effectiveVideoOn,
    isMicOn: !effectiveMuted,
    videoTrack: undefined, // local room uses native camera preview
  });

  // Co-host
  if (storeCoHost) {
    allParticipants.push({
      id: storeCoHost.user.id,
      user: storeCoHost.user,
      role: "co-host",
      isLocal: false,
      isCameraOn: storeCoHost.hasVideo || false,
      isMicOn: true,
    });
  }

  // Listeners
  storeListeners.forEach((l) => {
    allParticipants.push({
      id: l.user.id,
      user: l.user,
      role: "participant",
      isLocal: false,
      isCameraOn: false,
      isMicOn: false,
    });
  });

  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);
  const participantCount = allParticipants.length;

  return (
    <RoomLayout
      insets={insets}
      connectionState={storeConnectionState}
      isHost={true}
      roomTitle={roomTitle}
      participantCount={participantCount}
      allParticipants={allParticipants}
      activeSpeakers={activeSpeakers}
      effectiveMuted={effectiveMuted}
      effectiveVideoOn={effectiveVideoOn}
      isHandRaised={isHandRaised}
      hasVideo={roomHasVideo}
      isChatOpen={isChatOpen}
      showEjectModal={showEjectModal}
      ejectPayload={ejectPayload}
      roomId={id}
      localUser={localUser}
      onLeave={handleLeave}
      onToggleMic={handleToggleMic}
      onToggleVideo={handleToggleVideo}
      onToggleHand={handleToggleHand}
      onChat={handleChat}
      onCloseChat={handleCloseChat}
      onEjectDismiss={handleEjectDismiss}
      localRole="host"
    />
  );
}

// ── ServerRoom: full useVideoRoom for Fishjam-backed rooms ──────────

function ServerRoom({
  id,
  paramTitle,
  roomHasVideo = true,
  anonymous = false,
}: {
  id: string;
  paramTitle?: string;
  roomHasVideo?: boolean;
  anonymous?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);
  const endRoomHistory = useLynkHistoryStore((s) => s.endRoom);

  // VisionCamera permissions for native camera fallback
  const { requestPermission: requestCamPermission } = useCameraPermission();
  const { requestPermission: requestMicPermission } = useMicrophonePermission();

  const {
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    coHost: storeCoHost,
    listeners: storeListeners,
    toggleHand,
    setActiveSpeakerId,
    openChat,
    closeChat,
    showEject,
    hideEject,
    promoteListener,
    reset,
  } = useRoomStore();

  const videoRoom = useVideoRoom({
    roomId: id || "",
    anonymous,
    onEjected: (reason) => showEject(reason),
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended this room");
      router.back();
    },
    onError: (error) => showToast("error", "Error", error),
  });

  // When anonymous, use the anon label from the server response instead of real profile
  const localUser: SneakyUser =
    anonymous && videoRoom.localUser?.username?.startsWith("ANON LYNK")
      ? {
          id: videoRoom.localUser.id || authUser?.id || "local",
          username: videoRoom.localUser.username,
          displayName: videoRoom.localUser.username,
          avatar: "",
          isVerified: false,
          isAnonymous: true,
          anonLabel: videoRoom.localUser.username,
        }
      : buildLocalUser(authUser);
  const isHost = videoRoom.localUser?.role === "host";
  const effectiveMuted = !videoRoom.isMicOn;
  const effectiveVideoOn = videoRoom.isCameraOn;
  const connectionState =
    videoRoom.connectionState.status === "error"
      ? "disconnected"
      : (videoRoom.connectionState.status as
          | "connecting"
          | "connected"
          | "reconnecting"
          | "disconnected");

  // Reset store on mount, request permissions
  useEffect(() => {
    reset();
    if (roomHasVideo) requestCamPermission();
    requestMicPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join Fishjam room on mount (media starts in separate effect below)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      console.log("[SneakyLynk:Server] Joining room...", id);
      const joined = await videoRoom.join();
      if (!cancelled) {
        console.log("[SneakyLynk:Server] Join result:", joined);
      }
    })();
    return () => {
      cancelled = true;
      videoRoom.leave();
      audioSession.stop();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start camera + mic ONLY after Fishjam peer is fully connected.
  // toggleCamera/toggleMic must be called when peerStatus === "connected",
  // otherwise the Fishjam SDK creates local tracks but never publishes them.
  const mediaStartedRef = React.useRef(false);
  useEffect(() => {
    if (connectionState !== "connected" || mediaStartedRef.current) return;
    mediaStartedRef.current = true;

    (async () => {
      try {
        console.log(
          "[SneakyLynk:Server] Peer connected — starting media, isHost:",
          isHost,
        );
        audioSession.startForLynk(roomHasVideo);
        if (roomHasVideo) {
          console.log("[SneakyLynk:Server] Starting camera...");
          await videoRoom.toggleCamera();
        }
        console.log("[SneakyLynk:Server] Starting mic...");
        await videoRoom.toggleMic();
        console.log(
          "[SneakyLynk:Server] Media started for",
          isHost ? "host" : "participant",
        );
      } catch (e) {
        console.warn("[SneakyLynk:Server] Failed to start media:", e);
      }
    })();
  }, [connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speaking indicator
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
    } else {
      setActiveSpeakerId(localUser.id);
    }
  }, [effectiveMuted, localUser.id, setActiveSpeakerId]);

  const handleLeave = useCallback(async () => {
    if (isHost) {
      // Host ends the room for everyone
      try {
        await sneakyLynkApi.endRoom(id);
        console.log("[SneakyLynk:Server] Room ended in DB:", id);
      } catch (e) {
        console.error("[SneakyLynk:Server] Failed to end room in DB:", e);
      }
    } else {
      // Non-host: leave room (decrement participant_count, auto-end if empty)
      try {
        await sneakyLynkApi.leaveRoom(id);
        console.log("[SneakyLynk:Server] Left room in DB:", id);
      } catch (e) {
        console.error("[SneakyLynk:Server] Failed to leave room in DB:", e);
      }
    }
    endRoomHistory(id, storeListeners.length);
    router.back();
  }, [router, id, endRoomHistory, storeListeners.length, isHost]);
  const handleToggleMic = useCallback(async () => {
    await videoRoom.toggleMic();
  }, [videoRoom]);
  const handleToggleVideo = useCallback(async () => {
    await videoRoom.toggleCamera();
  }, [videoRoom]);
  const handleToggleHand = useCallback(() => toggleHand(), [toggleHand]);
  const handleChat = useCallback(() => openChat(), [openChat]);
  const handleCloseChat = useCallback(() => closeChat(), [closeChat]);
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  if (connectionState === "connecting" || connectionState === "disconnected") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-foreground mt-4">
          {connectionState === "connecting"
            ? "Joining room..."
            : "Preparing room..."}
        </Text>
      </View>
    );
  }

  const roomTitle = videoRoom.room?.title || paramTitle || "Room";
  const roomUuid = videoRoom.room?.id || id;

  // ── Host action state ────────────────────────────────────────────
  const [actionTarget, setActionTarget] = useState<VideoParticipant | null>(
    null,
  );

  // Build SneakyUser from a Fishjam participant
  const peerToUser = (p: any): SneakyUser => {
    const isAnon = p.isAnonymous || p.username?.startsWith("ANON LYNK");
    return {
      id: p.userId || p.oderId || p.odId,
      username: isAnon
        ? p.anonLabel || p.username || "ANON LYNK"
        : p.username || "User",
      displayName: isAnon
        ? p.anonLabel || p.username || "ANON LYNK"
        : p.username || "User",
      avatar: isAnon ? "" : p.avatar || "",
      isVerified: false,
      isAnonymous: isAnon,
      anonLabel: isAnon ? p.anonLabel || p.username : null,
    };
  };

  // ── Build flat VideoParticipant[] for VideoGrid ──────────────────
  const remotePeers = videoRoom.participants || [];
  const localCameraStream = videoRoom.camera?.cameraStream || null;

  const allParticipants: VideoParticipant[] = [];

  // Local user first (always shown at top-left)
  allParticipants.push({
    id: localUser.id,
    user: localUser,
    role: isHost ? "host" : videoRoom.localUser?.role || "participant",
    isLocal: true,
    isCameraOn: effectiveVideoOn,
    isMicOn: !effectiveMuted,
    videoTrack: localCameraStream ? { stream: localCameraStream } : undefined,
  });

  // Remote peers
  remotePeers.forEach((p: any) => {
    allParticipants.push({
      id: p.userId || p.oderId || p.odId,
      user: peerToUser(p),
      role: p.role || "participant",
      isLocal: false,
      isCameraOn: p.isCameraOn || false,
      isMicOn: p.isMicOn || false,
      videoTrack: p.videoTrack,
      audioTrack: p.audioTrack,
    });
  });

  // Active speakers
  const activeSpeakerIds = new Set<string>();
  if (!effectiveMuted) activeSpeakerIds.add(localUser.id);
  remotePeers.forEach((p: any) => {
    if (p.isMicOn) activeSpeakerIds.add(p.userId || p.oderId || p.odId);
  });

  const totalParticipants = allParticipants.length;

  // ── Host action handlers ─────────────────────────────────────────
  const handleMutePeer = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.mutePeer({ roomId: roomUuid, targetUserId });
      if (res.ok) {
        showToast("info", "Muted", "Participant has been muted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to mute");
      }
    },
    [roomUuid, showToast],
  );

  const [allMuted, setAllMuted] = useState(false);

  const handleToggleMuteAll = useCallback(async () => {
    if (allMuted) {
      const res = await videoApi.unmuteAll(roomUuid);
      if (res.ok) {
        setAllMuted(false);
        showToast("info", "Unmuted All", "All participants have been unmuted");
      } else {
        showToast(
          "error",
          "Error",
          res.error?.message || "Failed to unmute all",
        );
      }
    } else {
      const res = await videoApi.muteAll(roomUuid);
      if (res.ok) {
        setAllMuted(true);
        showToast("info", "Muted All", "All participants have been muted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to mute all");
      }
    }
  }, [roomUuid, allMuted, showToast]);

  const handleUnmutePeer = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.unmutePeer({ roomId: roomUuid, targetUserId });
      if (res.ok) {
        showToast("info", "Unmuted", "Participant has been unmuted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to unmute");
      }
    },
    [roomUuid, showToast],
  );

  const handleMakeCoHost = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.changeRole({
        roomId: roomUuid,
        targetUserId,
        newRole: "co-host",
      });
      if (res.ok) {
        showToast("info", "Promoted", "User is now a co-host");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to promote");
      }
    },
    [roomUuid, showToast],
  );

  const handleDemote = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.changeRole({
        roomId: roomUuid,
        targetUserId,
        newRole: "participant",
      });
      if (res.ok) {
        showToast("info", "Demoted", "User is now a participant");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to demote");
      }
    },
    [roomUuid, showToast],
  );

  const handleRemoveUser = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.kickUser({
        roomId: roomUuid,
        targetUserId,
        reason: "Removed by host",
      });
      if (res.ok) {
        showToast("info", "Removed", "User has been removed from the room");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to remove");
      }
    },
    [roomUuid, showToast],
  );

  const handleParticipantPress = useCallback((p: VideoParticipant) => {
    setActionTarget(p);
  }, []);

  return (
    <>
      <RoomLayout
        insets={insets}
        connectionState={connectionState}
        isHost={!!isHost}
        roomTitle={roomTitle}
        participantCount={totalParticipants}
        allParticipants={allParticipants}
        activeSpeakers={activeSpeakerIds}
        effectiveMuted={effectiveMuted}
        effectiveVideoOn={effectiveVideoOn}
        isHandRaised={isHandRaised}
        hasVideo={roomHasVideo}
        isChatOpen={isChatOpen}
        showEjectModal={showEjectModal}
        ejectPayload={ejectPayload}
        roomId={id}
        localUser={localUser}
        onLeave={handleLeave}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onToggleHand={handleToggleHand}
        onChat={handleChat}
        onCloseChat={handleCloseChat}
        onEjectDismiss={handleEjectDismiss}
        onParticipantPress={isHost ? handleParticipantPress : undefined}
        onMuteAll={isHost ? handleToggleMuteAll : undefined}
        allMuted={allMuted}
        localRole={isHost ? "host" : "participant"}
      />

      {/* Host action sheet — mute / co-host / remove */}
      <ParticipantActions
        visible={!!actionTarget}
        participant={
          actionTarget
            ? {
                userId: actionTarget.id,
                user: actionTarget.user,
                role: actionTarget.role,
                isMicOn: actionTarget.isMicOn,
              }
            : null
        }
        onMute={handleMutePeer}
        onUnmute={handleUnmutePeer}
        onMakeCoHost={handleMakeCoHost}
        onDemote={handleDemote}
        onRemove={handleRemoveUser}
        onClose={() => setActionTarget(null)}
      />
    </>
  );
}

// ── Shared Room Layout (pure presentation) ──────────────────────────

function RoomLayout({
  insets,
  connectionState,
  isHost,
  roomTitle,
  participantCount,
  allParticipants,
  activeSpeakers,
  effectiveMuted,
  effectiveVideoOn,
  isHandRaised,
  hasVideo,
  isChatOpen,
  showEjectModal,
  ejectPayload,
  roomId,
  localUser,
  onLeave,
  onToggleMic,
  onToggleVideo,
  onToggleHand,
  onChat,
  onCloseChat,
  onEjectDismiss,
  onParticipantPress,
  onMuteAll,
  allMuted,
  localRole,
}: {
  insets: any;
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  isHost: boolean;
  localRole: "host" | "co-host" | "participant";
  roomTitle: string;
  participantCount: number;
  allParticipants: VideoParticipant[];
  activeSpeakers: Set<string>;
  effectiveMuted: boolean;
  effectiveVideoOn: boolean;
  isHandRaised: boolean;
  hasVideo?: boolean;
  isChatOpen: boolean;
  showEjectModal: boolean;
  ejectPayload: any;
  roomId: string;
  localUser: SneakyUser;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleHand: () => void;
  onChat: () => void;
  onCloseChat: () => void;
  onEjectDismiss: () => void;
  onParticipantPress?: (p: VideoParticipant) => void;
  onMuteAll?: () => void;
  allMuted?: boolean;
}) {
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Connection Banner */}
      <ConnectionBanner state={connectionState} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={onLeave} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>

        <View className="flex-1 mx-4">
          <View className="flex-row items-center justify-center gap-2">
            <View className="flex-row items-center bg-red-500/20 px-2 py-1 rounded-full gap-1">
              <View className="w-2 h-2 rounded-full bg-red-500" />
              <Text className="text-red-500 text-xs font-bold">LIVE</Text>
            </View>
            {isHost && (
              <View className="flex-row items-center bg-primary/20 px-2 py-1 rounded-full">
                <Text className="text-primary text-xs font-bold">HOST</Text>
              </View>
            )}
            <View className="flex-row items-center gap-1">
              <Users size={14} color="#6B7280" />
              <Text className="text-muted-foreground text-sm">
                {participantCount}
              </Text>
            </View>
          </View>
          <Text
            className="text-foreground font-semibold text-center mt-1"
            numberOfLines={1}
          >
            {roomTitle}
          </Text>
        </View>

        {/* Mute / Unmute All toggle for host */}
        {isHost && onMuteAll ? (
          <Pressable
            onPress={onMuteAll}
            hitSlop={8}
            className={`flex-row items-center px-3 py-1.5 rounded-full gap-1.5 ${
              allMuted ? "bg-emerald-500/20" : "bg-red-500/20"
            }`}
          >
            {allMuted ? (
              <Mic size={14} color="#10B981" />
            ) : (
              <MicOff size={14} color="#EF4444" />
            )}
            <Text
              className={`text-xs font-bold ${
                allMuted ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {allMuted ? "UNMUTE ALL" : "MUTE ALL"}
            </Text>
          </Pressable>
        ) : (
          <Pressable hitSlop={12}>
            <MoreHorizontal size={24} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Video Grid — Zoom-like layout for all participants */}
      <View className="flex-1">
        <VideoGrid
          participants={allParticipants}
          activeSpeakers={activeSpeakers}
          isHost={isHost}
          onParticipantPress={onParticipantPress}
        />
      </View>

      {/* Room Timer — 16 min max, countdown in last 60s */}
      <RoomTimer onTimeUp={onLeave} />

      {/* Controls Bar */}
      <ControlsBar
        isMuted={effectiveMuted}
        isVideoEnabled={effectiveVideoOn}
        handRaised={isHandRaised}
        hasVideo={hasVideo ?? true}
        localRole={localRole}
        onLeave={onLeave}
        onToggleMute={onToggleMic}
        onToggleVideo={onToggleVideo}
        onToggleHand={onToggleHand}
        onOpenChat={onChat}
      />

      {/* Eject Modal */}
      <EjectModal
        visible={showEjectModal}
        payload={ejectPayload}
        onDismiss={onEjectDismiss}
      />

      {/* Chat Sheet */}
      <ChatSheet
        isOpen={isChatOpen}
        onClose={onCloseChat}
        roomId={roomId}
        currentUser={localUser}
        participants={allParticipants.map((p) => p.user)}
      />
    </View>
  );
}
