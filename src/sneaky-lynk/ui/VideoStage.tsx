/**
 * Video Stage Component
 * Supports single or dual (split-screen) video views for host + co-host.
 * Uses Fishjam RTCView for rendering WebRTC video tracks.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BadgeCheck, Video } from "lucide-react-native";
import { RTCView } from "@fishjam-cloud/react-native-client";
import {
  Camera as VisionCamera,
  useCameraDevice,
} from "react-native-vision-camera";
import type { SneakyUser } from "../types";

interface FeaturedSpeaker {
  id: string;
  user: SneakyUser;
  isSpeaking: boolean;
  hasVideo: boolean;
}

interface VideoStageProps {
  featuredSpeaker: FeaturedSpeaker | null;
  coHost?: FeaturedSpeaker | null;
  isSpeaking: boolean;
  isLocalUser?: boolean;
  isVideoEnabled?: boolean;
  videoTrack?: any;
  coHostVideoTrack?: any;
  isCoHostLocal?: boolean;
  /** Use expo-camera CameraView for local preview (no Fishjam connection) */
  useNativeCamera?: boolean;
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

function SpeakerLabel({
  user,
  isSpeaking,
  role,
}: {
  user: SneakyUser;
  isSpeaking: boolean;
  role?: string;
}) {
  return (
    <>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          right: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {role && (
          <View
            style={{
              backgroundColor: role === "host" ? "#FC253A" : "#8A40CF",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
              {role === "host" ? "HOST" : "CO-HOST"}
            </Text>
          </View>
        )}
        <Text
          style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
          numberOfLines={1}
        >
          {user.displayName}
        </Text>
        {user.isVerified && (
          <BadgeCheck size={12} color="#FF6DC1" fill="#FF6DC1" />
        )}
      </View>
      {isSpeaking && (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          <SoundWave />
        </View>
      )}
    </>
  );
}

function VideoPanel({
  speaker,
  videoTrack,
  isLocal,
  style,
  role,
  useNativeCamera,
}: {
  speaker: FeaturedSpeaker;
  videoTrack?: any;
  isLocal?: boolean;
  style?: any;
  role?: string;
  useNativeCamera?: boolean;
}) {
  const hasStream = videoTrack?.stream;
  const frontDevice = useCameraDevice("front");

  // Determine what to render for video
  const renderVideo = () => {
    // VisionCamera preview — for local rooms without Fishjam connection
    if (useNativeCamera && isLocal && frontDevice) {
      return (
        <VisionCamera
          style={StyleSheet.absoluteFill}
          device={frontDevice}
          isActive={true}
          photo={false}
          video={false}
        />
      );
    }
    // Fishjam RTCView — for server-backed rooms with WebRTC streams
    if (hasStream) {
      return (
        <RTCView
          mediaStream={videoTrack.stream}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={isLocal}
        />
      );
    }
    // Fallback: avatar
    return (
      <Image
        source={{ uri: speaker.user.avatar }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    );
  };

  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#1a1a1a" }, style]}>
      {renderVideo()}
      <SpeakerLabel
        user={speaker.user}
        isSpeaking={speaker.isSpeaking}
        role={role}
      />
      {speaker.hasVideo && (
        <View
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <Video size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

export function VideoStage({
  featuredSpeaker,
  coHost,
  isSpeaking,
  isLocalUser = false,
  isVideoEnabled = false,
  videoTrack,
  coHostVideoTrack,
  isCoHostLocal = false,
  useNativeCamera = false,
  onSelectSpeaker,
}: VideoStageProps) {
  const frontDevice = useCameraDevice("front");

  if (!featuredSpeaker) return null;

  const isDual = !!coHost;

  // Dual view: host and co-host side by side
  if (isDual) {
    return (
      <View className="px-4 mb-5">
        <View
          style={{
            flexDirection: "row",
            height: 220,
            borderRadius: 20,
            overflow: "hidden",
            gap: 3,
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => onSelectSpeaker?.(featuredSpeaker.user.id)}
          >
            <VideoPanel
              speaker={featuredSpeaker}
              videoTrack={isVideoEnabled ? videoTrack : undefined}
              isLocal={isLocalUser}
              useNativeCamera={useNativeCamera}
              style={{
                flex: 1,
                borderTopLeftRadius: 20,
                borderBottomLeftRadius: 20,
              }}
              role="host"
            />
          </Pressable>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => onSelectSpeaker?.(coHost.user.id)}
          >
            <VideoPanel
              speaker={coHost}
              videoTrack={coHostVideoTrack}
              isLocal={isCoHostLocal}
              style={{
                flex: 1,
                borderTopRightRadius: 20,
                borderBottomRightRadius: 20,
              }}
              role="co-host"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // Single view: just the featured speaker
  const hasVideoStream = isVideoEnabled && videoTrack?.stream;
  const showNativeCamera = useNativeCamera && isLocalUser && isVideoEnabled;

  return (
    <View className="px-4 mb-5">
      <Pressable
        onPress={() => onSelectSpeaker?.(featuredSpeaker.user.id)}
        className="w-full h-[220px] rounded-[20px] overflow-hidden bg-card relative"
      >
        {showNativeCamera && frontDevice ? (
          <VisionCamera
            style={StyleSheet.absoluteFill}
            device={frontDevice}
            isActive={true}
            photo={false}
            video={false}
          />
        ) : hasVideoStream ? (
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

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          className="absolute bottom-0 left-0 right-0 h-[100px]"
        />

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

        {isSpeaking && (
          <View className="absolute top-4 right-4 bg-black/50 px-2.5 py-1.5 rounded-xl">
            <SoundWave />
          </View>
        )}

        {featuredSpeaker.hasVideo && (
          <View className="absolute top-4 left-4 bg-black/50 p-1.5 rounded-lg">
            <Video size={14} color="#fff" />
          </View>
        )}
      </Pressable>
    </View>
  );
}
