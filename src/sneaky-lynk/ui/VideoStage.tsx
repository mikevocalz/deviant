/**
 * Video Stage Component
 * Featured speaker video with overlay info
 * Uses Fishjam RTCView for rendering WebRTC video tracks
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BadgeCheck, Video } from "lucide-react-native";
import { RTCView } from "@fishjam-cloud/react-native-client";
import type { SneakyUser } from "../types";

interface FeaturedSpeaker {
  id: string;
  user: SneakyUser;
  isSpeaking: boolean;
  hasVideo: boolean;
}

interface VideoStageProps {
  featuredSpeaker: FeaturedSpeaker | null;
  isSpeaking: boolean;
  isLocalUser?: boolean;
  isVideoEnabled?: boolean;
  videoTrack?: any; // Fishjam video track (local or remote) with .stream
  onSelectSpeaker?: (userId: string) => void;
}

function SoundWave() {
  return (
    <View className="flex-row items-center gap-0.5 h-4">
      <View className="w-[3px] h-1.5 bg-green-500 rounded-sm" />
      <View className="w-[3px] h-3 bg-green-500 rounded-sm" />
      <View className="w-[3px] h-4 bg-green-500 rounded-sm" />
      <View className="w-[3px] h-3 bg-green-500 rounded-sm" />
      <View className="w-[3px] h-1.5 bg-green-500 rounded-sm" />
    </View>
  );
}

export function VideoStage({
  featuredSpeaker,
  isSpeaking,
  isLocalUser = false,
  isVideoEnabled = false,
  videoTrack,
  onSelectSpeaker,
}: VideoStageProps) {
  if (!featuredSpeaker) return null;

  const hasVideoStream = isVideoEnabled && videoTrack?.stream;

  return (
    <View className="px-4 mb-5">
      <Pressable
        onPress={() => {
          onSelectSpeaker?.(featuredSpeaker.user.id);
        }}
        className="w-full h-[220px] rounded-[20px] overflow-hidden bg-card relative"
      >
        {/* Fishjam RTCView for video tracks (local or remote) */}
        {hasVideoStream ? (
          <RTCView
            mediaStream={videoTrack.stream}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={isLocalUser}
          />
        ) : (
          <Image
            source={{ uri: featuredSpeaker.user.avatar }}
            className="w-full h-full"
            contentFit="cover"
          />
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          className="absolute bottom-0 left-0 right-0 h-[100px]"
        />

        {/* Speaker info */}
        <View className="absolute bottom-4 left-4 flex-row items-center gap-2.5">
          <View className="flex-row items-center bg-destructive px-2 py-1 rounded-md gap-1">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-[10px] font-bold text-white">LIVE</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-semibold text-white">
              {featuredSpeaker.user.displayName}
            </Text>
            {featuredSpeaker.user.isVerified && (
              <BadgeCheck size={14} color="#FF6DC1" fill="#FF6DC1" />
            )}
          </View>
        </View>

        {/* Speaking indicator */}
        {isSpeaking && (
          <View className="absolute top-4 right-4 bg-black/50 px-2.5 py-1.5 rounded-xl">
            <SoundWave />
          </View>
        )}

        {/* Video badge */}
        {featuredSpeaker.hasVideo && (
          <View className="absolute top-4 left-4 bg-black/50 p-1.5 rounded-lg">
            <Video size={14} color="#fff" />
          </View>
        )}
      </Pressable>
    </View>
  );
}
