/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 * Uses Fishjam for real audio/video — no mock data
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

export default function SneakyLynkRoomScreen() {
  const { id, title: paramTitle } = useLocalSearchParams<{
    id: string;
    title?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);

  // Fishjam camera & mic hooks
  const fishjamCamera = useCamera();
  const fishjamMic = useMicrophone();

  // Room store
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
    showEject,
    hideEject,
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

  // Real Fishjam video room hook (used for server-backed rooms)
  const isServerRoom = !id?.startsWith("space-") && id !== "my-room";
  const videoRoom = useVideoRoom({
    roomId: isServerRoom ? id || "" : "",
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

  // Build local user as SneakyUser from auth store
  const localUser: SneakyUser = {
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

  // Derived state
  const isHost = isServerRoom ? videoRoom.localUser?.role === "host" : true;
  const effectiveMuted = isServerRoom
    ? !videoRoom.isMicOn
    : !fishjamMic.isMicrophoneOn;
  const effectiveVideoOn = isServerRoom
    ? videoRoom.isCameraOn
    : fishjamCamera.isCameraOn;
  const connectionState = isServerRoom
    ? videoRoom.connectionState.status === "error"
      ? "disconnected"
      : (videoRoom.connectionState.status as
          | "connecting"
          | "connected"
          | "reconnecting"
          | "disconnected")
    : storeConnectionState;

  // Simulate speaking indicator based on mic activity
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
      return;
    }
    // When mic is on, show the local user as speaking
    setActiveSpeakerId(localUser.id);
  }, [effectiveMuted, localUser.id, setActiveSpeakerId]);

  // Reset store on mount
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    reset();
  }, [reset]);

  // Start camera & mic on mount
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    (async () => {
      if (isServerRoom && id) {
        const joined = await videoRoom.join();
        if (joined) {
          try {
            await videoRoom.toggleCamera();
            await videoRoom.toggleMic();
          } catch (e) {
            console.warn("[SneakyLynk] Failed to start media:", e);
          }
        }
      } else {
        try {
          console.log("[SneakyLynk] Starting local camera & mic");
          await fishjamCamera.startCamera();
          await fishjamMic.startMicrophone();
        } catch (e) {
          console.warn("[SneakyLynk] Failed to start local media:", e);
        }
      }
    })();

    return () => {
      if (isServerRoom) {
        videoRoom.leave();
      } else {
        fishjamCamera.stopCamera();
        fishjamMic.stopMicrophone();
      }
      hasJoinedRef.current = false;
    };
  }, [isServerRoom, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeave = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleMic = useCallback(async () => {
    if (isServerRoom) {
      await videoRoom.toggleMic();
    } else {
      if (fishjamMic.isMicrophoneOn) {
        fishjamMic.stopMicrophone();
      } else {
        await fishjamMic.startMicrophone();
      }
    }
  }, [isServerRoom, videoRoom, fishjamMic]);

  const handleToggleVideo = useCallback(async () => {
    if (isServerRoom) {
      await videoRoom.toggleCamera();
    } else {
      if (fishjamCamera.isCameraOn) {
        fishjamCamera.stopCamera();
      } else {
        await fishjamCamera.startCamera();
      }
    }
  }, [isServerRoom, videoRoom, fishjamCamera]);

  const handleToggleHand = useCallback(() => {
    toggleHand();
  }, [toggleHand]);

  const handleChat = useCallback(() => {
    openChat();
  }, [openChat]);

  const handleCloseChat = useCallback(() => {
    closeChat();
  }, [closeChat]);

  const handleSendMessage = useCallback(
    (content: string) => {
      const newMessage = {
        id: `msg-${Date.now()}`,
        user: localUser,
        content,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [newMessage, ...prev]);
    },
    [localUser],
  );

  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  // Loading state for server rooms
  if (isServerRoom && connectionState === "connecting") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-foreground mt-4">Joining room...</Text>
      </View>
    );
  }

  // Room data
  const roomTitle = isServerRoom
    ? videoRoom.room?.title || paramTitle || "Room"
    : paramTitle || "Sneaky Lynk";
  const participantCount = isServerRoom ? videoRoom.participants.length + 1 : 1;

  // Build speakers list — local user is always a speaker
  const allSpeakers: SneakyUser[] = [localUser];

  // Add remote participants as speakers (for server rooms)
  if (isServerRoom && videoRoom.participants.length > 0) {
    videoRoom.participants.forEach((p) => {
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

  // No separate listeners for now — everyone is a speaker
  const listeners: { id: string; user: SneakyUser }[] = [];

  // Featured speaker for VideoStage
  const featuredSpeakerUser =
    allSpeakers.find((s) => s.id === activeSpeakerId) || localUser;
  const featuredSpeaker = {
    id: featuredSpeakerUser.id,
    user: featuredSpeakerUser,
    isSpeaking: featuredSpeakerUser.id === activeSpeakerId,
    hasVideo: effectiveVideoOn,
  };

  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);

  // Camera stream for VideoStage
  const cameraStream = isServerRoom
    ? videoRoom.camera?.cameraStream
    : fishjamCamera.cameraStream;

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
          isLocalUser={featuredSpeakerUser.id === localUser.id}
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
        currentUser={localUser}
      />
    </View>
  );
}
