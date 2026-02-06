/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 * Now wrapped in FishjamProvider for real audio/video
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
import { Camera } from "react-native-vision-camera";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import {
  mockSpaces,
  mockUsers,
  currentUserMock,
} from "@/src/sneaky-lynk/mocks/data";
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

export default function SneakyLynkRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  // Camera & mic permissions (VisionCamera)
  const cameraPermissionRef = useRef<string | null>(null);
  const micPermissionRef = useRef<string | null>(null);

  // Room store
  const {
    isMuted,
    isVideoOn,
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    connectionState: storeConnectionState,
    setIsMuted,
    setIsVideoOn,
    toggleMute,
    toggleVideo,
    toggleHand,
    setActiveSpeakerId,
    openChat,
    closeChat,
    showEject,
    hideEject,
    setConnectionState,
    reset,
  } = useRoomStore();

  // Chat messages state
  const [chatMessages, setChatMessages] = React.useState<
    Array<{
      id: string;
      user: SneakyUser;
      content: string;
      timestamp: Date;
    }>
  >([]);

  // Determine if this is a mock room or real room
  const isMockRoom = id?.startsWith("space-") || id === "my-room";
  const mockSpace = mockSpaces.find((s) => s.id === id);

  // Real Fishjam video room hook
  const videoRoom = useVideoRoom({
    roomId: isMockRoom ? "" : id || "",
    onEjected: (reason) => {
      showEject(reason);
    },
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended this room");
      router.back();
    },
    onError: (error) => {
      showToast("error", "Error", error);
    },
  });

  // Reset store on mount and set initial state based on host status
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    reset();
    const isHostUser = mockSpace?.host.id === currentUserMock.id;
    if (isHostUser) {
      setIsMuted(false);
      setIsVideoOn(true);
    }
  }, [id, mockSpace, reset, setIsMuted, setIsVideoOn]);

  // Derived state based on mock vs real
  const isHost = isMockRoom
    ? mockSpace?.host.id === currentUserMock.id
    : videoRoom.localUser?.role === "host";
  const effectiveMuted = isMockRoom ? isMuted : !videoRoom.isMicOn;
  const effectiveVideoOn = isMockRoom ? isVideoOn : videoRoom.isCameraOn;
  const connectionState = isMockRoom
    ? storeConnectionState
    : videoRoom.connectionState.status === "error"
      ? "disconnected"
      : (videoRoom.connectionState.status as
          | "connecting"
          | "connected"
          | "reconnecting"
          | "disconnected");

  // Simulate active speaker rotation for mock rooms
  useEffect(() => {
    if (!isMockRoom || !mockSpace) return;

    const allSpeakers = [mockSpace.host, ...mockSpace.speakers];
    let index = 0;

    const interval = setInterval(() => {
      setActiveSpeakerId(allSpeakers[index % allSpeakers.length].id);
      index++;
    }, 3000);

    return () => clearInterval(interval);
  }, [isMockRoom, mockSpace]);

  // Join real room on mount (only for non-mock rooms)
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (!isMockRoom && id && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      (async () => {
        const joined = await videoRoom.join();
        if (joined) {
          // Auto-start camera for host
          try {
            await videoRoom.toggleCamera();
            await videoRoom.toggleMic();
          } catch (e) {
            console.warn("[SneakyLynk] Failed to start media:", e);
          }
        }
      })();
    }
    return () => {
      if (!isMockRoom && hasJoinedRef.current) {
        videoRoom.leave();
        hasJoinedRef.current = false;
      }
    };
  }, [isMockRoom, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeave = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleMic = useCallback(async () => {
    if (isMockRoom) {
      // Request mic permission if not granted yet
      if (micPermissionRef.current !== "granted") {
        const result = await Camera.requestMicrophonePermission();
        micPermissionRef.current = result;
        if (result !== "granted") return;
      }
      toggleMute();
    } else {
      await videoRoom.toggleMic();
    }
  }, [isMockRoom, videoRoom, toggleMute]);

  const handleToggleVideo = useCallback(async () => {
    if (isMockRoom) {
      // Request camera permission if not granted yet
      if (cameraPermissionRef.current !== "granted") {
        const result = await Camera.requestCameraPermission();
        cameraPermissionRef.current = result;
        if (result !== "granted") return;
      }
      toggleVideo();
    } else {
      await videoRoom.toggleCamera();
    }
  }, [isMockRoom, videoRoom, toggleVideo]);

  const handleToggleHand = useCallback(() => {
    toggleHand();
  }, [toggleHand]);

  const handleChat = useCallback(() => {
    console.log("[SneakyLynk] Chat pressed - opening sheet");
    openChat();
  }, [openChat]);

  const handleCloseChat = useCallback(() => {
    closeChat();
  }, [closeChat]);

  const handleSendMessage = useCallback((content: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      user: currentUserMock,
      content,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [newMessage, ...prev]);
  }, []);

  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  // Room not found (for mock rooms)
  if (isMockRoom && !mockSpace) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground text-lg">Room not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Loading state for real rooms
  if (!isMockRoom && connectionState === "connecting") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-foreground mt-4">Joining room...</Text>
      </View>
    );
  }

  // Get room data (mock or real)
  const roomTitle = isMockRoom
    ? mockSpace!.title
    : videoRoom.room?.title || "Room";
  const roomListeners = isMockRoom
    ? mockSpace!.listeners
    : videoRoom.participants.length;
  const roomHasVideo = isMockRoom ? mockSpace!.hasVideo : true;

  // Build a SneakyUser for the local user in real rooms so VideoStage can render
  const localSneakyUser: SneakyUser | null =
    !isMockRoom && videoRoom.localUser
      ? {
          id: videoRoom.localUser.id,
          username: videoRoom.localUser.username || "You",
          displayName: videoRoom.localUser.username || "You",
          avatar:
            videoRoom.localUser.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              videoRoom.localUser.username || "U",
            )}&background=1a1a1a&color=fff`,
          isVerified: false,
        }
      : null;

  const allSpeakerUsers: SneakyUser[] = isMockRoom
    ? [mockSpace!.host, ...mockSpace!.speakers]
    : localSneakyUser
      ? [localSneakyUser]
      : [];
  const featuredSpeakerUser = isMockRoom
    ? activeSpeakerId
      ? allSpeakerUsers.find((s) => s.id === activeSpeakerId) || mockSpace!.host
      : mockSpace!.host
    : localSneakyUser;

  // Transform to Speaker format for SpeakerGrid
  const speakers = allSpeakerUsers.map((user, index) => ({
    id: user.id,
    user,
    role: index === 0 ? ("host" as const) : ("speaker" as const),
    isSpeaking: user.id === activeSpeakerId,
  }));

  // Transform to Listener format for ListenerGrid
  const listeners = mockUsers.slice(3, 10).map((user) => ({
    id: user.id,
    user,
  }));

  // Featured speaker for VideoStage
  const featuredSpeaker = featuredSpeakerUser
    ? {
        id: featuredSpeakerUser.id,
        user: featuredSpeakerUser,
        isSpeaking: featuredSpeakerUser.id === activeSpeakerId,
        hasVideo: effectiveVideoOn,
      }
    : null;

  // Active speakers set for SpeakerGrid
  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Connection Banner */}
      <ConnectionBanner state={connectionState} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={handleLeave} hitSlop={12}>
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
                {roomListeners.toLocaleString()}
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
        {/* Video Stage (if room has video) */}
        {roomHasVideo && featuredSpeaker && (
          <VideoStage
            featuredSpeaker={featuredSpeaker}
            isSpeaking={featuredSpeaker.isSpeaking}
            isLocalUser={isHost}
            isVideoEnabled={effectiveVideoOn}
          />
        )}

        {/* Speakers Grid */}
        <SpeakerGrid speakers={speakers} activeSpeakers={activeSpeakers} />

        {/* Listeners Grid */}
        <View className="mb-24">
          <ListenerGrid listeners={listeners} />
        </View>
      </ScrollView>

      {/* Controls Bar */}
      <ControlsBar
        isMuted={effectiveMuted}
        isVideoEnabled={effectiveVideoOn}
        handRaised={isHandRaised}
        hasVideo={roomHasVideo}
        onLeave={handleLeave}
        onToggleMute={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onToggleHand={handleToggleHand}
        onOpenChat={handleChat}
      />

      {/* Eject Modal */}
      <EjectModal
        visible={showEjectModal}
        payload={ejectPayload}
        onDismiss={handleEjectDismiss}
      />

      {/* Chat Sheet (75% height) */}
      <ChatSheet
        isOpen={isChatOpen}
        onClose={handleCloseChat}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentUser={currentUserMock}
      />
    </View>
  );
}
