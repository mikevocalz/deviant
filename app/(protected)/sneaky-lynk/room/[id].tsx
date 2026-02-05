/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 * Uses the real Fishjam video infrastructure
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
import { useState, useEffect, useCallback } from "react";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import { VideoTile } from "@/src/video/ui/VideoTile";
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
} from "@/src/sneaky-lynk/ui";
import type { SneakyUser, EjectPayload } from "@/src/sneaky-lynk/types";
import { useUIStore } from "@/lib/stores/ui-store";

export default function SneakyLynkRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);

  // For mock rooms, use mock data; for real rooms, use Fishjam
  const isMockRoom = id?.startsWith("space-") || id === "my-room";
  const mockSpace = mockSpaces.find((s) => s.id === id);

  // Real Fishjam video room hook (only used for real rooms)
  const videoRoom = useVideoRoom({
    roomId: isMockRoom ? "" : id || "",
    onEjected: (reason) => {
      setEjectPayload(reason);
      setShowEjectModal(true);
    },
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended this room");
      router.back();
    },
    onError: (error) => {
      showToast("error", "Error", error);
    },
  });

  // Local state for mock rooms
  const [mockIsMuted, setMockIsMuted] = useState(false);
  const [mockIsVideoOn, setMockIsVideoOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [showEjectModal, setShowEjectModal] = useState(false);
  const [ejectPayload, setEjectPayload] = useState<EjectPayload | null>(null);

  // Determine if using mock or real
  const isHost = isMockRoom
    ? mockSpace?.host.id === currentUserMock.id
    : videoRoom.localUser?.role === "host";

  const isMuted = isMockRoom ? mockIsMuted : !videoRoom.isMicOn;
  const isVideoOn = isMockRoom ? mockIsVideoOn : videoRoom.isCameraOn;
  const connectionState:
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected" = isMockRoom
    ? "connected"
    : videoRoom.connectionState.status === "error" ||
        videoRoom.connectionState.status === "disconnected"
      ? "disconnected"
      : (videoRoom.connectionState.status as
          | "connecting"
          | "connected"
          | "reconnecting");

  // Simulate active speaker rotation for mock rooms
  useEffect(() => {
    if (!mockSpace) return;

    const allSpeakers = [mockSpace.host, ...mockSpace.speakers];
    let index = 0;

    const interval = setInterval(() => {
      setActiveSpeakerId(allSpeakers[index % allSpeakers.length].id);
      index++;
    }, 3000);

    return () => clearInterval(interval);
  }, [mockSpace]);

  // Join real room on mount
  useEffect(() => {
    if (!isMockRoom && id) {
      videoRoom.join();
    }
    return () => {
      if (!isMockRoom) {
        videoRoom.leave();
      }
    };
  }, [isMockRoom, id]);

  const handleLeave = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleMic = useCallback(async () => {
    if (isMockRoom) {
      setMockIsMuted((prev: boolean) => !prev);
    } else {
      await videoRoom.toggleMic();
    }
  }, [isMockRoom, videoRoom]);

  const handleToggleVideo = useCallback(async () => {
    if (isMockRoom) {
      setMockIsVideoOn((prev: boolean) => !prev);
    } else {
      await videoRoom.toggleCamera();
    }
  }, [isMockRoom, videoRoom]);

  const handleToggleHand = useCallback(() => {
    setIsHandRaised((prev) => !prev);
  }, []);

  const handleChat = useCallback(() => {
    // TODO: Open chat modal
    console.log("[SneakyLynk] Chat pressed");
  }, []);

  const handleEjectDismiss = useCallback(() => {
    setShowEjectModal(false);
    router.back();
  }, [router]);

  // For mock rooms, check if space exists
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

  // For real rooms, show loading while connecting
  if (!isMockRoom && connectionState === "connecting") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3EA4E5" />
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

  const allSpeakerUsers: SneakyUser[] = isMockRoom
    ? [mockSpace!.host, ...mockSpace!.speakers]
    : [];
  const featuredSpeakerUser = activeSpeakerId
    ? allSpeakerUsers.find((s) => s.id === activeSpeakerId) ||
      (isMockRoom ? mockSpace!.host : null)
    : isMockRoom
      ? mockSpace!.host
      : null;

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
        hasVideo: isVideoOn,
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
            isVideoEnabled={isVideoOn}
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
        isMuted={isMuted}
        isVideoEnabled={isVideoOn}
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
    </View>
  );
}
