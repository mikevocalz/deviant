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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MoreHorizontal, Users } from "lucide-react-native";
import React, { useEffect, useCallback, useRef } from "react";
import {
  useCameraPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";
import { useCamera, useMicrophone } from "@fishjam-cloud/react-native-client";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  VideoStage,
  SpeakerGrid,
  ListenerGrid,
  ControlsBar,
  ConnectionBanner,
  EjectModal,
  ChatSheet,
  RoomTimer,
} from "@/src/sneaky-lynk/ui";
import type { SneakyUser } from "@/src/sneaky-lynk/types";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRoomStore } from "@/src/sneaky-lynk/stores/room-store";
import { useLynkHistoryStore } from "@/src/sneaky-lynk/stores/lynk-history-store";
import { sneakyLynkApi } from "@/src/sneaky-lynk/api/supabase";
import { audioSession } from "@/src/services/calls/audioSession";

// ── Shared helpers ──────────────────────────────────────────────────

function buildLocalUser(authUser: any): SneakyUser {
  return {
    id: authUser?.id || "local",
    username: authUser?.username || "You",
    displayName: authUser?.name || authUser?.username || "You",
    avatar:
      authUser?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        authUser?.username || "U",
      )}&background=1a1a1a&color=fff&rounded=true`,
    isVerified: authUser?.isVerified || false,
  };
}

// ── Router entry point ──────────────────────────────────────────────

export default function SneakyLynkRoomScreen() {
  const {
    id,
    title: paramTitle,
    hasVideo: hasVideoParam,
  } = useLocalSearchParams<{
    id: string;
    title?: string;
    hasVideo?: string;
  }>();

  const roomHasVideo = hasVideoParam === "1";
  const isServerRoom = !id?.startsWith("space-") && id !== "my-room";

  if (isServerRoom) {
    return (
      <ServerRoom id={id} paramTitle={paramTitle} roomHasVideo={roomHasVideo} />
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
    reset,
  } = useRoomStore();

  const [chatMessages, setChatMessages] = React.useState<
    Array<{ id: string; user: SneakyUser; content: string; timestamp: Date }>
  >([]);

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
  const handleSendMessage = useCallback(
    (content: string) => {
      setChatMessages((prev) => [
        {
          id: `msg-${Date.now()}`,
          user: localUser,
          content,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    },
    [localUser],
  );
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  const roomTitle = paramTitle || "Sneaky Lynk";

  // Build speakers list — host + co-host
  const speakers: {
    id: string;
    user: SneakyUser;
    role: "host" | "co-host" | "speaker";
    isSpeaking: boolean;
  }[] = [
    {
      id: localUser.id,
      user: localUser,
      role: "host",
      isSpeaking: localUser.id === activeSpeakerId,
    },
  ];
  if (storeCoHost) {
    speakers.push({
      id: storeCoHost.user.id,
      user: storeCoHost.user,
      role: "co-host",
      isSpeaking: storeCoHost.user.id === activeSpeakerId,
    });
  }

  const featuredSpeaker = {
    id: localUser.id,
    user: localUser,
    isSpeaking: localUser.id === activeSpeakerId,
    hasVideo: effectiveVideoOn,
  };

  // Co-host featured speaker for dual view
  const coHostFeatured = storeCoHost
    ? {
        id: storeCoHost.user.id,
        user: storeCoHost.user,
        isSpeaking: storeCoHost.user.id === activeSpeakerId,
        hasVideo: storeCoHost.hasVideo || false,
      }
    : null;

  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);
  const participantCount = 1 + (storeCoHost ? 1 : 0) + storeListeners.length;

  return (
    <RoomLayout
      insets={insets}
      connectionState={storeConnectionState}
      isHost={true}
      roomTitle={roomTitle}
      participantCount={participantCount}
      featuredSpeaker={featuredSpeaker}
      coHost={coHostFeatured}
      isLocalUser={true}
      effectiveVideoOn={effectiveVideoOn}
      cameraStream={null}
      useNativeCamera={true}
      speakers={speakers}
      activeSpeakers={activeSpeakers}
      storeListeners={storeListeners}
      effectiveMuted={effectiveMuted}
      isHandRaised={isHandRaised}
      hasVideo={roomHasVideo}
      isChatOpen={isChatOpen}
      showEjectModal={showEjectModal}
      ejectPayload={ejectPayload}
      chatMessages={chatMessages}
      localUser={localUser}
      onLeave={handleLeave}
      onToggleMic={handleToggleMic}
      onToggleVideo={handleToggleVideo}
      onToggleHand={handleToggleHand}
      onChat={handleChat}
      onCloseChat={handleCloseChat}
      onSendMessage={handleSendMessage}
      onEjectDismiss={handleEjectDismiss}
    />
  );
}

// ── ServerRoom: full useVideoRoom for Fishjam-backed rooms ──────────

function ServerRoom({
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
    reset,
  } = useRoomStore();

  const [chatMessages, setChatMessages] = React.useState<
    Array<{ id: string; user: SneakyUser; content: string; timestamp: Date }>
  >([]);

  const videoRoom = useVideoRoom({
    roomId: id || "",
    onEjected: (reason) => showEject(reason),
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended this room");
      router.back();
    },
    onError: (error) => showToast("error", "Error", error),
  });

  const localUser = buildLocalUser(authUser);
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
        console.log("[SneakyLynk:Server] Peer connected — starting media");
        audioSession.startForLynk(roomHasVideo);
        if (roomHasVideo) {
          console.log("[SneakyLynk:Server] Starting camera...");
          await videoRoom.toggleCamera();
        }
        console.log("[SneakyLynk:Server] Starting mic...");
        await videoRoom.toggleMic();
        console.log("[SneakyLynk:Server] Media started successfully");
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
    // If host, end the room in the database so all users see it as ended
    if (isHost) {
      try {
        await sneakyLynkApi.endRoom(id);
        console.log("[SneakyLynk:Server] Room ended in DB:", id);
      } catch (e) {
        console.error("[SneakyLynk:Server] Failed to end room in DB:", e);
      }
    }
    endRoomHistory(id, storeListeners.length);
    router.back();
  }, [router, id, endRoomHistory, storeListeners.length, isHost]);
  const handleToggleMic = useCallback(
    async () => videoRoom.toggleMic(),
    [videoRoom],
  );
  const handleToggleVideo = useCallback(
    async () => videoRoom.toggleCamera(),
    [videoRoom],
  );
  const handleToggleHand = useCallback(() => toggleHand(), [toggleHand]);
  const handleChat = useCallback(() => openChat(), [openChat]);
  const handleCloseChat = useCallback(() => closeChat(), [closeChat]);
  const handleSendMessage = useCallback(
    (content: string) => {
      setChatMessages((prev) => [
        {
          id: `msg-${Date.now()}`,
          user: localUser,
          content,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    },
    [localUser],
  );
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  if (connectionState === "connecting") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-foreground mt-4">Joining room...</Text>
      </View>
    );
  }

  const roomTitle = videoRoom.room?.title || paramTitle || "Room";

  // Build participant lists from Fishjam peers
  const remotePeers = videoRoom.participants || [];
  const localCameraStream = videoRoom.camera?.cameraStream || null;

  // Find the host among remote peers (if we're a listener, the host is remote)
  const remoteHost = remotePeers.find((p: any) => p.role === "host");
  const remoteCoHostPeer = remotePeers.find((p: any) => p.role === "co-host");

  // Build SneakyUser from a Fishjam participant
  const peerToUser = (p: any): SneakyUser => ({
    id: p.userId || p.oderId || p.odId,
    username: p.username || "User",
    displayName: p.username || "User",
    avatar:
      p.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        p.username || "U",
      )}&background=1a1a1a&color=fff&rounded=true`,
    isVerified: false,
  });

  // Featured speaker: if we're host, show our own camera. If listener, show the host's remote video.
  let featuredUser: SneakyUser;
  let featuredVideoTrack: any = undefined;
  let featuredIsLocal = false;
  let featuredHasVideo = false;

  if (isHost) {
    // We are the host — show our own camera
    featuredUser = localUser;
    featuredVideoTrack = localCameraStream
      ? { stream: localCameraStream }
      : undefined;
    featuredIsLocal = true;
    featuredHasVideo = effectiveVideoOn;
  } else if (remoteHost) {
    // We are a listener — show the host's remote video track
    featuredUser = peerToUser(remoteHost);
    featuredVideoTrack = remoteHost.videoTrack;
    featuredIsLocal = false;
    featuredHasVideo = remoteHost.isCameraOn || false;
  } else {
    // No host found yet (still connecting) — show local user as placeholder
    featuredUser = localUser;
    featuredIsLocal = true;
    featuredHasVideo = false;
  }

  const featuredSpeaker = {
    id: featuredUser.id,
    user: featuredUser,
    isSpeaking: !effectiveMuted || (remoteHost?.isMicOn ?? false),
    hasVideo: featuredHasVideo,
  };

  // Co-host
  const effectiveCoHost = remoteCoHostPeer
    ? peerToUser(remoteCoHostPeer)
    : storeCoHost?.user || null;
  const coHostFeatured = effectiveCoHost
    ? {
        id: effectiveCoHost.id,
        user: effectiveCoHost,
        isSpeaking: remoteCoHostPeer?.isMicOn || false,
        hasVideo: remoteCoHostPeer?.isCameraOn || false,
      }
    : null;
  const coHostTrack = remoteCoHostPeer?.videoTrack || undefined;

  // Speakers list (host + co-host)
  const speakers: any[] = [
    {
      id: featuredUser.id,
      user: featuredUser,
      role: "host" as const,
      isSpeaking: featuredSpeaker.isSpeaking,
    },
  ];
  if (effectiveCoHost) {
    speakers.push({
      id: effectiveCoHost.id,
      user: effectiveCoHost,
      role: "co-host" as const,
      isSpeaking: coHostFeatured?.isSpeaking || false,
    });
  }

  // Listeners: all remote peers that are NOT host or co-host
  const listenersFromPeers = remotePeers
    .filter((p: any) => p.role !== "host" && p.role !== "co-host")
    .map((p: any) => ({ user: peerToUser(p), role: "listener" }));
  // If we're NOT the host, add ourselves to listeners
  if (!isHost) {
    listenersFromPeers.unshift({ user: localUser, role: "listener" });
  }
  // Merge with store listeners (dedup by id)
  const seenIds = new Set(listenersFromPeers.map((l: any) => l.user.id));
  const mergedListeners = [
    ...listenersFromPeers,
    ...storeListeners.filter((l) => !seenIds.has(l.user.id)),
  ];

  const activeSpeakerIds = new Set<string>();
  if (!effectiveMuted && isHost) activeSpeakerIds.add(localUser.id);
  remotePeers.forEach((p: any) => {
    if (p.isMicOn) activeSpeakerIds.add(p.userId || p.oderId || p.odId);
  });

  const totalParticipants = remotePeers.length + 1;

  // Use native camera preview for local host when Fishjam stream isn't ready yet
  const useNativeForLocal = isHost && roomHasVideo && !localCameraStream;

  return (
    <RoomLayout
      insets={insets}
      connectionState={connectionState}
      isHost={!!isHost}
      roomTitle={roomTitle}
      participantCount={totalParticipants}
      featuredSpeaker={featuredSpeaker}
      coHost={coHostFeatured}
      isLocalUser={featuredIsLocal}
      effectiveVideoOn={
        featuredHasVideo || (isHost && roomHasVideo && useNativeForLocal)
      }
      cameraStream={featuredIsLocal ? localCameraStream : null}
      featuredVideoTrack={!featuredIsLocal ? featuredVideoTrack : undefined}
      coHostVideoTrack={coHostTrack}
      isCoHostLocal={false}
      useNativeCamera={useNativeForLocal}
      speakers={speakers}
      activeSpeakers={activeSpeakerIds}
      storeListeners={mergedListeners}
      effectiveMuted={effectiveMuted}
      isHandRaised={isHandRaised}
      hasVideo={roomHasVideo}
      isChatOpen={isChatOpen}
      showEjectModal={showEjectModal}
      ejectPayload={ejectPayload}
      chatMessages={chatMessages}
      localUser={localUser}
      onLeave={handleLeave}
      onToggleMic={handleToggleMic}
      onToggleVideo={handleToggleVideo}
      onToggleHand={handleToggleHand}
      onChat={handleChat}
      onCloseChat={handleCloseChat}
      onSendMessage={handleSendMessage}
      onEjectDismiss={handleEjectDismiss}
    />
  );
}

// ── Shared Room Layout (pure presentation) ──────────────────────────

function RoomLayout({
  insets,
  connectionState,
  isHost,
  roomTitle,
  participantCount,
  featuredSpeaker,
  coHost,
  isLocalUser,
  effectiveVideoOn,
  cameraStream,
  featuredVideoTrack,
  coHostVideoTrack,
  isCoHostLocal,
  useNativeCamera,
  speakers,
  activeSpeakers,
  storeListeners,
  effectiveMuted,
  isHandRaised,
  hasVideo,
  isChatOpen,
  showEjectModal,
  ejectPayload,
  chatMessages,
  localUser,
  onLeave,
  onToggleMic,
  onToggleVideo,
  onToggleHand,
  onChat,
  onCloseChat,
  onSendMessage,
  onEjectDismiss,
}: {
  insets: any;
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  isHost: boolean;
  roomTitle: string;
  participantCount: number;
  featuredSpeaker: any;
  coHost?: any;
  isLocalUser: boolean;
  effectiveVideoOn: boolean;
  cameraStream: any;
  featuredVideoTrack?: any;
  coHostVideoTrack?: any;
  isCoHostLocal?: boolean;
  useNativeCamera?: boolean;
  speakers: any[];
  activeSpeakers: Set<string>;
  storeListeners?: { user: SneakyUser; role: string }[];
  effectiveMuted: boolean;
  isHandRaised: boolean;
  hasVideo?: boolean;
  isChatOpen: boolean;
  showEjectModal: boolean;
  ejectPayload: any;
  chatMessages: any[];
  localUser: SneakyUser;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleHand: () => void;
  onChat: () => void;
  onCloseChat: () => void;
  onSendMessage: (content: string) => void;
  onEjectDismiss: () => void;
}) {
  const listeners = (storeListeners || []).map((l) => ({
    id: l.user.id,
    user: l.user,
  }));

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

        <Pressable hitSlop={12}>
          <MoreHorizontal size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Video Stage */}
        <VideoStage
          featuredSpeaker={featuredSpeaker}
          coHost={coHost}
          isSpeaking={featuredSpeaker.isSpeaking}
          isLocalUser={isLocalUser}
          isVideoEnabled={effectiveVideoOn}
          videoTrack={
            featuredVideoTrack ||
            (cameraStream ? { stream: cameraStream } : undefined)
          }
          coHostVideoTrack={coHostVideoTrack}
          isCoHostLocal={isCoHostLocal}
          useNativeCamera={useNativeCamera}
        />

        {/* Speakers Grid */}
        <SpeakerGrid speakers={speakers} activeSpeakers={activeSpeakers} />

        {/* Listeners Grid */}
        {listeners.length > 0 && (
          <View className="mb-24">
            <ListenerGrid listeners={listeners} />
          </View>
        )}
      </ScrollView>

      {/* Room Timer — 16 min max, countdown in last 60s */}
      <RoomTimer onTimeUp={onLeave} />

      {/* Controls Bar */}
      <ControlsBar
        isMuted={effectiveMuted}
        isVideoEnabled={effectiveVideoOn}
        handRaised={isHandRaised}
        hasVideo={hasVideo ?? true}
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

      {/* Chat Sheet (75% height) */}
      <ChatSheet
        isOpen={isChatOpen}
        onClose={onCloseChat}
        messages={chatMessages}
        onSendMessage={onSendMessage}
        currentUser={localUser}
      />
    </View>
  );
}
