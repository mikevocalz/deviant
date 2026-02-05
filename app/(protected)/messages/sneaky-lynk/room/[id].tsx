/**
 * Sneaky Lynk Room Screen
 * Audio-first live room with optional video stage
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Animated, Easing } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import {
  X,
  Users,
  MoreHorizontal,
  BadgeCheck,
  Video,
} from "lucide-react-native";

import {
  ConnectionBanner,
  ControlsBar,
  EjectModal,
  VideoStage,
  VideoThumbnailRow,
  ListenerGrid,
} from "@/src/sneaky-lynk/ui";
import { mockSpaces, mockUsers } from "@/src/sneaky-lynk/mocks/data";
import type { SneakyUser, EjectPayload, ConnectionState } from "@/src/sneaky-lynk/types";

// Speaker card with animated pulse rings
interface SpeakerCardProps {
  speaker: SneakyUser;
  isActive: boolean;
  isHost: boolean;
}

function SpeakerCard({ speaker, isActive, isHost }: SpeakerCardProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const startAnimation = useCallback(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    scaleAnimation.start();
  }, [pulseAnim, scaleAnim]);

  const stopAnimation = useCallback(() => {
    pulseAnim.stopAnimation();
    scaleAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseAnim, scaleAnim]);

  useEffect(() => {
    if (isActive) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => stopAnimation();
  }, [isActive, startAnimation, stopAnimation]);

  const pulseOpacityOuter = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const pulseScaleOuter = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  const pulseOpacityInner = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  const pulseScaleInner = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  return (
    <View className="items-center w-[100px]">
      <View className="relative mb-2.5 w-20 h-20 items-center justify-center">
        {/* Pulse rings */}
        {isActive && (
          <>
            <Animated.View
              className="absolute w-[72px] h-[72px] rounded-full border-[3px] border-green-500"
              style={{
                opacity: pulseOpacityOuter,
                transform: [{ scale: pulseScaleOuter }],
              }}
            />
            <Animated.View
              className="absolute w-[72px] h-[72px] rounded-full border-[3px] border-primary"
              style={{
                opacity: pulseOpacityInner,
                transform: [{ scale: pulseScaleInner }],
              }}
            />
          </>
        )}

        {/* Avatar */}
        <Animated.View
          className="w-[72px] h-[72px] rounded-full"
          style={{ transform: [{ scale: isActive ? scaleAnim : 1 }] }}
        >
          <Image
            source={{ uri: speaker.avatar }}
            className={`w-[72px] h-[72px] rounded-full border-[3px] ${
              isActive ? "border-green-500" : "border-secondary"
            }`}
          />
        </Animated.View>

        {/* Host badge */}
        {isHost && (
          <View className="absolute -top-1 -right-1 bg-primary px-2 py-0.5 rounded-[10px]">
            <Text className="text-[10px] font-bold text-white">Host</Text>
          </View>
        )}

        {/* Speaking indicator */}
        <View
          className={`absolute bottom-0.5 right-0.5 w-[18px] h-[18px] rounded-[9px] border-[3px] border-background ${
            isActive ? "bg-green-500" : "bg-muted-foreground"
          }`}
        />
      </View>

      {/* Name */}
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-semibold text-foreground max-w-[80px]" numberOfLines={1}>
          {speaker.displayName}
        </Text>
        {speaker.isVerified && (
          <BadgeCheck size={12} color="#FF6DC1" fill="#FF6DC1" />
        )}
      </View>

      {/* Username */}
      <Text className="text-xs text-muted-foreground mt-0.5">
        @{speaker.username}
      </Text>
    </View>
  );
}

export default function SneakyLynkRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Find space from mock data
  // TODO: Replace with real Supabase query + Fishjam connection
  const space = mockSpaces.find((s) => s.id === id) || mockSpaces[0];
  const allSpeakers = [space.host, ...space.speakers];
  const listeners = mockUsers.slice(0, 6);

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set([space.host.id]));
  const [speakersWithVideo, setSpeakersWithVideo] = useState<Set<string>>(new Set());
  const [featuredSpeaker, setFeaturedSpeaker] = useState(space.host);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isEjected, setIsEjected] = useState(false);
  const [ejectReason, setEjectReason] = useState<EjectPayload | null>(null);

  // Initialize video speakers
  useEffect(() => {
    if (space.hasVideo) {
      const videoSpeakers = new Set<string>();
      videoSpeakers.add(space.host.id);
      if (space.speakers.length > 0) {
        videoSpeakers.add(space.speakers[0].id);
      }
      setSpeakersWithVideo(videoSpeakers);
    }
  }, [space]);

  // Simulate active speaker changes
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * allSpeakers.length);
      const randomSpeaker = allSpeakers[randomIndex];

      setActiveSpeakers((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(randomSpeaker.id) && newSet.size > 1) {
          newSet.delete(randomSpeaker.id);
        } else {
          newSet.add(randomSpeaker.id);
          if (speakersWithVideo.has(randomSpeaker.id)) {
            setFeaturedSpeaker(randomSpeaker);
          }
        }
        return newSet;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [allSpeakers, speakersWithVideo]);

  // Handlers
  const handleLeave = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    if (!space.hasVideo) return;
    setIsVideoEnabled((prev) => !prev);
  }, [space.hasVideo]);

  const handleToggleHand = useCallback(() => {
    setHandRaised((prev) => !prev);
  }, []);

  const handleOpenChat = useCallback(() => {
    // TODO: Implement chat modal
    console.log("[SneakyLynk] Open chat");
  }, []);

  const handleSelectFeaturedSpeaker = useCallback((userId: string) => {
    const speaker = allSpeakers.find((s) => s.id === userId);
    if (speaker) {
      setFeaturedSpeaker(speaker);
    }
  }, [allSpeakers]);

  const handleEjectDismiss = useCallback(() => {
    setIsEjected(false);
    setEjectReason(null);
    router.back();
  }, [router]);

  // Video speakers for thumbnail row
  const videoSpeakers = allSpeakers
    .filter((s) => speakersWithVideo.has(s.id))
    .map((s) => ({
      id: s.id,
      user: s,
      isSpeaking: activeSpeakers.has(s.id),
      hasVideo: true,
    }));

  // Listeners for grid
  const listenerItems = listeners.map((l) => ({
    id: l.id,
    user: l,
  }));

  return (
    <View className="flex-1 bg-background">
      {/* Background gradient */}
      <LinearGradient
        colors={["#1a1a1a", "#000"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 pb-4"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          onPress={handleLeave}
          className="w-11 h-11 rounded-full bg-secondary items-center justify-center"
        >
          <X size={24} color="#fff" />
        </Pressable>

        <View className="flex-row items-center gap-2.5">
          <View className="flex-row items-center bg-destructive px-3 py-1.5 rounded-[14px] gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-white text-xs font-bold">LIVE</Text>
          </View>
          <View className="flex-row items-center bg-secondary px-3 py-1.5 rounded-[14px] gap-1.5">
            <Users size={14} color="#a3a3a3" />
            <Text className="text-muted-foreground text-[13px] font-semibold">
              {space.listeners.toLocaleString()}
            </Text>
          </View>
        </View>

        <Pressable className="w-11 h-11 rounded-full bg-secondary items-center justify-center">
          <MoreHorizontal size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Connection Banner */}
      <ConnectionBanner state={connectionState} />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Video Stage (if room has video) */}
        {space.hasVideo && (
          <>
            <VideoStage
              featuredSpeaker={{
                id: featuredSpeaker.id,
                user: featuredSpeaker,
                isSpeaking: activeSpeakers.has(featuredSpeaker.id),
                hasVideo: speakersWithVideo.has(featuredSpeaker.id),
              }}
              isSpeaking={activeSpeakers.has(featuredSpeaker.id)}
              onSelectSpeaker={handleSelectFeaturedSpeaker}
            />
            <VideoThumbnailRow
              speakers={videoSpeakers}
              featuredSpeakerId={featuredSpeaker.id}
              activeSpeakers={activeSpeakers}
              onSelectSpeaker={handleSelectFeaturedSpeaker}
            />
          </>
        )}

        {/* Title Section */}
        <View className="px-5 pb-6 items-center">
          <Text className="text-[13px] font-semibold text-primary mb-2 uppercase tracking-wider">
            {space.topic}
          </Text>
          <Text className="text-2xl font-extrabold text-foreground text-center mb-2 tracking-tight">
            {space.title}
          </Text>
          <Text className="text-[15px] text-muted-foreground text-center leading-[22px]">
            {space.description}
          </Text>
          {!isMuted && (
            <View className="flex-row items-center bg-destructive px-3 py-2 rounded-2xl gap-2 mt-4">
              <View className="w-2 h-2 rounded-full bg-white" />
              <Text className="text-[13px] font-semibold text-white">You are speaking</Text>
            </View>
          )}
        </View>

        {/* Speakers Grid */}
        <View className="px-5 mb-6">
          <Text className="text-base font-bold text-foreground mb-4">Speakers</Text>
          <View className="flex-row flex-wrap gap-4 justify-center">
            {allSpeakers.map((speaker, index) => (
              <SpeakerCard
                key={speaker.id}
                speaker={speaker}
                isActive={activeSpeakers.has(speaker.id)}
                isHost={index === 0}
              />
            ))}
          </View>
        </View>

        {/* Listeners Grid */}
        <ListenerGrid listeners={listenerItems} />

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Controls Bar */}
      <ControlsBar
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        handRaised={handRaised}
        hasVideo={space.hasVideo}
        onLeave={handleLeave}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleHand={handleToggleHand}
        onOpenChat={handleOpenChat}
      />

      {/* Eject Modal */}
      <EjectModal
        visible={isEjected}
        payload={ejectReason}
        onDismiss={handleEjectDismiss}
      />
    </View>
  );
}
