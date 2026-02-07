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
} from "@/src/sneaky-lynk/ui";
import type { SneakyUser } from "@/src/sneaky-lynk/types";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRoomStore } from "@/src/sneaky-lynk/stores/room-store";

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
  const { id, title: paramTitle } = useLocalSearchParams<{
    id: string;
    title?: string;
  }>();

  const isServerRoom = !id?.startsWith("space-") && id !== "my-room";

  // Render completely separate components so useVideoRoom's internal
  // useCamera() never runs in the same component as the local camera.
  if (isServerRoom) {
    return <ServerRoom id={id} paramTitle={paramTitle} />;
  }
  return <LocalRoom id={id} paramTitle={paramTitle} />;
}

// ── LocalRoom: direct Fishjam camera/mic, NO useVideoRoom ──────────

function LocalRoom({ id, paramTitle }: { id: string; paramTitle?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const fishjamCamera = useCamera();
  const fishjamMic = useMicrophone();

  const {
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    connectionState: storeConnectionState,
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

  const localUser = buildLocalUser(authUser);
  const effectiveMuted = !fishjamMic.isMicrophoneOn;
  const effectiveVideoOn = fishjamCamera.isCameraOn;

  // Reset store on mount
  useEffect(() => {
    reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start camera & mic on mount, stop on unmount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log("[SneakyLynk:Local] Starting camera & mic");
        await fishjamCamera.startCamera();
        if (!cancelled) await fishjamMic.startMicrophone();
        console.log("[SneakyLynk:Local] Camera & mic started");
      } catch (e) {
        console.warn("[SneakyLynk:Local] Failed to start media:", e);
      }
    })();
    return () => {
      cancelled = true;
      fishjamCamera.stopCamera();
      fishjamMic.stopMicrophone();
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

  const handleLeave = useCallback(() => router.back(), [router]);
  const handleToggleMic = useCallback(async () => {
    if (fishjamMic.isMicrophoneOn) fishjamMic.stopMicrophone();
    else await fishjamMic.startMicrophone();
  }, [fishjamMic]);
  const handleToggleVideo = useCallback(async () => {
    if (fishjamCamera.isCameraOn) fishjamCamera.stopCamera();
    else await fishjamCamera.startCamera();
  }, [fishjamCamera]);
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
  const speakers = [
    {
      id: localUser.id,
      user: localUser,
      role: "host" as const,
      isSpeaking: localUser.id === activeSpeakerId,
    },
  ];
  const featuredSpeaker = {
    id: localUser.id,
    user: localUser,
    isSpeaking: localUser.id === activeSpeakerId,
    hasVideo: effectiveVideoOn,
  };
  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);
  const cameraStream = fishjamCamera.cameraStream;

  return (
    <RoomLayout
      insets={insets}
      connectionState={storeConnectionState}
      isHost={true}
      roomTitle={roomTitle}
      participantCount={1}
      featuredSpeaker={featuredSpeaker}
      isLocalUser={true}
      effectiveVideoOn={effectiveVideoOn}
      cameraStream={cameraStream}
      speakers={speakers}
      activeSpeakers={activeSpeakers}
      effectiveMuted={effectiveMuted}
      isHandRaised={isHandRaised}
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

function ServerRoom({ id, paramTitle }: { id: string; paramTitle?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);

  const {
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
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

  // Reset store on mount
  useEffect(() => {
    reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join room on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const joined = await videoRoom.join();
      if (joined && !cancelled) {
        try {
          await videoRoom.toggleCamera();
          await videoRoom.toggleMic();
        } catch (e) {
          console.warn("[SneakyLynk:Server] Failed to start media:", e);
        }
      }
    })();
    return () => {
      cancelled = true;
      videoRoom.leave();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speaking indicator
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
    } else {
      setActiveSpeakerId(localUser.id);
    }
  }, [effectiveMuted, localUser.id, setActiveSpeakerId]);

  const handleLeave = useCallback(() => router.back(), [router]);
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
  const participantCount = videoRoom.participants.length + 1;

  const allSpeakers: SneakyUser[] = [localUser];
  if (videoRoom.participants.length > 0) {
    videoRoom.participants.forEach((p: any) => {
      allSpeakers.push({
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
    });
  }

  const speakers = allSpeakers.map((user, index) => ({
    id: user.id,
    user,
    role: index === 0 ? ("host" as const) : ("speaker" as const),
    isSpeaking: user.id === activeSpeakerId,
  }));
  const featuredSpeakerUser =
    allSpeakers.find((s) => s.id === activeSpeakerId) || localUser;
  const featuredSpeaker = {
    id: featuredSpeakerUser.id,
    user: featuredSpeakerUser,
    isSpeaking: featuredSpeakerUser.id === activeSpeakerId,
    hasVideo: effectiveVideoOn,
  };
  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);
  const cameraStream = videoRoom.camera?.cameraStream || null;

  return (
    <RoomLayout
      insets={insets}
      connectionState={connectionState}
      isHost={!!isHost}
      roomTitle={roomTitle}
      participantCount={participantCount}
      featuredSpeaker={featuredSpeaker}
      isLocalUser={featuredSpeakerUser.id === localUser.id}
      effectiveVideoOn={effectiveVideoOn}
      cameraStream={cameraStream}
      speakers={speakers}
      activeSpeakers={activeSpeakers}
      effectiveMuted={effectiveMuted}
      isHandRaised={isHandRaised}
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
  isLocalUser,
  effectiveVideoOn,
  cameraStream,
  speakers,
  activeSpeakers,
  effectiveMuted,
  isHandRaised,
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
  isLocalUser: boolean;
  effectiveVideoOn: boolean;
  cameraStream: any;
  speakers: any[];
  activeSpeakers: Set<string>;
  effectiveMuted: boolean;
  isHandRaised: boolean;
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
  const listeners: { id: string; user: SneakyUser }[] = [];

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
          isSpeaking={featuredSpeaker.isSpeaking}
          isLocalUser={isLocalUser}
          isVideoEnabled={effectiveVideoOn}
          videoTrack={cameraStream ? { stream: cameraStream } : undefined}
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

      {/* Controls Bar */}
      <ControlsBar
        isMuted={effectiveMuted}
        isVideoEnabled={effectiveVideoOn}
        handRaised={isHandRaised}
        hasVideo={true}
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
