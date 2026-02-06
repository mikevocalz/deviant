/**
 * Video Call Screen
 *
 * FaceTime-style group video call UI with:
 * - Adaptive video grid (1–9 participants)
 * - Floating glass-morphism controls bar
 * - Participants bottom sheet
 * - Speaker highlight ring
 *
 * Distinct from Sneaky Link (Clubhouse-style rooms).
 * Uses the app's NativeWind design tokens for consistent dark aesthetic.
 */

import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RTCView } from "@fishjam-cloud/react-native-client";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  UserPlus,
  X,
  SwitchCamera,
  Volume2,
} from "lucide-react-native";
import { Image } from "expo-image";
import { Motion, AnimatePresence } from "@legendapp/motion";
import * as Haptics from "expo-haptics";
import { useVideoCall, type Participant } from "@/lib/hooks/use-video-call";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Grid layout helper ──────────────────────────────────────────────
function getGridLayout(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

// ── Video Tile ──────────────────────────────────────────────────────
function VideoTile({
  stream,
  isVideoOff,
  isMuted,
  isSpeaker,
  label,
  avatar,
  mirror,
  width,
  height,
}: {
  stream?: any;
  isVideoOff: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  label: string;
  avatar?: string;
  mirror?: boolean;
  width: number;
  height: number;
}) {
  return (
    <View
      className={`rounded-2xl overflow-hidden bg-card relative ${
        isSpeaker ? "border-2 border-primary" : "border border-border/30"
      }`}
      style={{ width, height, margin: 4 }}
    >
      {stream && !isVideoOff ? (
        <RTCView
          mediaStream={stream}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={mirror}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-card">
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-3xl font-bold">
                {label.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Name pill */}
      <View className="absolute bottom-2 left-2 flex-row items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
        <Text className="text-white text-xs font-medium">{label}</Text>
        {isMuted && <MicOff size={12} color="rgba(255,255,255,0.7)" />}
      </View>

      {/* Speaker indicator */}
      {isSpeaker && (
        <View className="absolute top-2 right-2 bg-primary/80 p-1 rounded-md">
          <Volume2 size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────
export default function VideoCallScreen() {
  const { roomId, isOutgoing, participantIds } = useLocalSearchParams<{
    roomId?: string;
    isOutgoing?: string;
    participantIds?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [showParticipants, setShowParticipants] = useState(false);

  const {
    isConnected,
    isInCall,
    localStream,
    participants,
    speakerId,
    isMuted,
    isVideoOff,
    error,
    connect,
    createCall,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    addParticipant,
    setSpeaker,
  } = useVideoCall();

  // Connect and start/join call on mount
  useEffect(() => {
    const initCall = async () => {
      await connect();

      if (isOutgoing === "true" && participantIds) {
        const ids = participantIds.split(",");
        await createCall(ids, ids.length > 1);
      } else if (roomId) {
        await joinCall(roomId);
      }
    };

    initCall();
  }, [roomId, isOutgoing, participantIds]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showToast("error", "Call Error", error);
    }
  }, [error, showToast]);

  const handleEndCall = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    leaveCall();
    router.back();
  }, [leaveCall, router]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMute();
  }, [toggleMute]);

  const handleToggleVideo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleVideo();
  }, [toggleVideo]);

  const handleSwitchCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchCamera();
  }, [switchCamera]);

  const handleAddParticipant = useCallback(() => {
    showToast("info", "Coming Soon", "Add participant feature coming soon");
  }, [showToast]);

  // Grid dimensions
  const totalParticipants = participants.length + 1;
  const { cols, rows } = getGridLayout(totalParticipants);
  const tileWidth = (SCREEN_WIDTH - 24) / cols;
  const tileHeight = (SCREEN_HEIGHT - 200) / rows;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Connection Status */}
      {!isConnected && (
        <View className="absolute top-16 left-0 right-0 z-50 items-center">
          <View className="bg-amber-500/20 px-4 py-2 rounded-full">
            <Text className="text-amber-400 text-sm font-medium">
              Connecting...
            </Text>
          </View>
        </View>
      )}

      {/* Video Grid */}
      <View className="flex-1 flex-row flex-wrap justify-center items-center p-2">
        {/* Local Video */}
        <VideoTile
          stream={localStream}
          isVideoOff={isVideoOff}
          isMuted={isMuted}
          isSpeaker={speakerId === user?.id}
          label="You"
          avatar={
            user?.avatar ||
            `https://ui-avatars.com/api/?name=${user?.username}&background=1a1a1a&color=fff`
          }
          mirror={true}
          width={tileWidth - 8}
          height={tileHeight - 8}
        />

        {/* Remote Videos */}
        {participants.map((p) => (
          <VideoTile
            key={p.oderId}
            stream={p.stream}
            isVideoOff={p.isVideoOff}
            isMuted={p.isMuted}
            isSpeaker={speakerId === p.oderId}
            label={p.username || "?"}
            width={tileWidth - 8}
            height={tileHeight - 8}
          />
        ))}
      </View>

      {/* Floating Controls Bar */}
      <View
        className="absolute left-4 right-4 flex-row items-center justify-center gap-4 px-6 py-4 bg-card/90 rounded-full border border-border/50"
        style={{ bottom: insets.bottom + 16 }}
      >
        {/* Mic */}
        <Pressable
          className={`w-12 h-12 rounded-full items-center justify-center ${
            isMuted ? "bg-destructive" : "bg-muted/80"
          }`}
          onPress={handleToggleMute}
        >
          {isMuted ? (
            <MicOff size={22} color="#fff" />
          ) : (
            <Mic size={22} color="#fff" />
          )}
        </Pressable>

        {/* Camera */}
        <Pressable
          className={`w-12 h-12 rounded-full items-center justify-center ${
            isVideoOff ? "bg-destructive" : "bg-muted/80"
          }`}
          onPress={handleToggleVideo}
        >
          {isVideoOff ? (
            <VideoOff size={22} color="#fff" />
          ) : (
            <Video size={22} color="#fff" />
          )}
        </Pressable>

        {/* Switch Camera */}
        {!isVideoOff && (
          <Pressable
            className="w-12 h-12 rounded-full items-center justify-center bg-muted/80"
            onPress={handleSwitchCamera}
          >
            <SwitchCamera size={22} color="#fff" />
          </Pressable>
        )}

        {/* Participants */}
        <Pressable
          className="w-12 h-12 rounded-full items-center justify-center bg-muted/80 relative"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowParticipants(true);
          }}
        >
          <Users size={22} color="#fff" />
          {participants.length > 0 && (
            <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-[10px] font-bold">
                {participants.length + 1}
              </Text>
            </View>
          )}
        </Pressable>

        {/* End Call */}
        <Pressable
          className="w-14 h-14 rounded-full items-center justify-center bg-destructive"
          onPress={handleEndCall}
        >
          <PhoneOff size={26} color="#fff" />
        </Pressable>
      </View>

      {/* Participants Bottom Sheet */}
      <AnimatePresence>
        {showParticipants && (
          <>
            <Pressable
              className="absolute inset-0 bg-black/60"
              onPress={() => setShowParticipants(false)}
            />
            <Motion.View
              initial={{ translateY: 400 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 400 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border"
              style={{
                maxHeight: SCREEN_HEIGHT * 0.6,
                paddingBottom: insets.bottom,
              }}
            >
              {/* Handle */}
              <View className="w-10 h-1 rounded-full bg-muted-foreground/30 self-center mt-3 mb-2" />

              {/* Header */}
              <View className="flex-row justify-between items-center px-5 pb-3 border-b border-border">
                <Text className="text-foreground text-lg font-semibold">
                  Participants
                </Text>
                <Pressable
                  onPress={() => setShowParticipants(false)}
                  hitSlop={12}
                >
                  <X size={22} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              {/* List */}
              <ScrollView className="max-h-[300px]">
                {/* Self */}
                <View className="flex-row items-center px-5 py-3 gap-3">
                  <Image
                    source={{
                      uri:
                        user?.avatar ||
                        `https://ui-avatars.com/api/?name=${user?.username}&background=1a1a1a&color=fff`,
                    }}
                    className="w-11 h-11 rounded-full"
                  />
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-medium">
                      You
                    </Text>
                    {speakerId === user?.id && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Volume2 size={10} color="#FC253A" />
                        <Text className="text-primary text-xs">Speaking</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row gap-2">
                    {isMuted && (
                      <MicOff size={16} color="rgba(255,255,255,0.3)" />
                    )}
                    {isVideoOff && (
                      <VideoOff size={16} color="rgba(255,255,255,0.3)" />
                    )}
                  </View>
                </View>

                {/* Others */}
                {participants.map((p) => (
                  <Pressable
                    key={p.oderId}
                    className="flex-row items-center px-5 py-3 gap-3 active:bg-muted/50"
                    onPress={() => setSpeaker(p.oderId)}
                  >
                    <View className="w-11 h-11 rounded-full bg-primary items-center justify-center">
                      <Text className="text-white text-lg font-bold">
                        {p.username?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-base font-medium">
                        {p.username}
                      </Text>
                      {speakerId === p.oderId && (
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <Volume2 size={10} color="#FC253A" />
                          <Text className="text-primary text-xs">Speaking</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-2">
                      {p.isMuted && (
                        <MicOff size={16} color="rgba(255,255,255,0.3)" />
                      )}
                      {p.isVideoOff && (
                        <VideoOff size={16} color="rgba(255,255,255,0.3)" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Add Participant */}
              <Pressable
                className="flex-row items-center justify-center gap-2 py-4 border-t border-border active:bg-muted/50"
                onPress={handleAddParticipant}
              >
                <UserPlus size={20} color="#FC253A" />
                <Text className="text-primary text-base font-medium">
                  Add participant
                </Text>
              </Pressable>
            </Motion.View>
          </>
        )}
      </AnimatePresence>
    </View>
  );
}
