/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 */

import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MoreHorizontal, Users } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { mockSpaces, mockUsers } from "@/src/sneaky-lynk/mocks/data";
import {
  VideoStage,
  SpeakerGrid,
  ListenerGrid,
  ControlsBar,
  ConnectionBanner,
  EjectModal,
} from "@/src/sneaky-lynk/ui";
import type {
  SneakyUser,
  ConnectionState,
  EjectPayload,
} from "@/src/sneaky-lynk/types";

export default function SneakyLynkRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Find mock space
  const space = mockSpaces.find((s) => s.id === id);

  // Room state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connected");
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [showEjectModal, setShowEjectModal] = useState(false);
  const [ejectPayload, setEjectPayload] = useState<EjectPayload | null>(null);

  // Simulate active speaker rotation
  useEffect(() => {
    if (!space) return;

    const allSpeakers = [space.host, ...space.speakers];
    let index = 0;

    const interval = setInterval(() => {
      setActiveSpeakerId(allSpeakers[index % allSpeakers.length].id);
      index++;
    }, 3000);

    return () => clearInterval(interval);
  }, [space]);

  const handleLeave = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleMic = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    setIsVideoOn((prev) => !prev);
  }, []);

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

  if (!space) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground text-lg">Room not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const allSpeakerUsers: SneakyUser[] = [space.host, ...space.speakers];
  const featuredSpeakerUser = activeSpeakerId
    ? allSpeakerUsers.find((s) => s.id === activeSpeakerId) || space.host
    : space.host;

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
  const featuredSpeaker = {
    id: featuredSpeakerUser.id,
    user: featuredSpeakerUser,
    isSpeaking: featuredSpeakerUser.id === activeSpeakerId,
    hasVideo: isVideoOn,
  };

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
            <View className="flex-row items-center gap-1">
              <Users size={14} color="#6B7280" />
              <Text className="text-muted-foreground text-sm">
                {space.listeners.toLocaleString()}
              </Text>
            </View>
          </View>
          <Text
            className="text-foreground font-semibold text-center mt-1"
            numberOfLines={1}
          >
            {space.title}
          </Text>
        </View>

        <Pressable hitSlop={12}>
          <MoreHorizontal size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Video Stage (if room has video) */}
        {space.hasVideo && (
          <VideoStage
            featuredSpeaker={featuredSpeaker}
            isSpeaking={featuredSpeaker.isSpeaking}
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
        hasVideo={space.hasVideo}
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
