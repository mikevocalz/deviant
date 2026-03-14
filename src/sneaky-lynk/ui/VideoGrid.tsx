/**
 * VideoGrid Component
 * Zoom-like adaptive video grid for all participants.
 * Layout adapts: 1=full, 2=split, 3-4=2x2, 5-6=3x2, etc.
 * Shows RTCView for camera-on participants, avatar placeholder for camera-off.
 */

import React, { memo, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { RTCView } from "@fishjam-cloud/react-native-client";
import { LinearGradient } from "expo-linear-gradient";
import {
  BadgeCheck,
  Mic,
  MicOff,
  VideoOff,
  Crown,
  EyeOff,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import type { SneakyUser } from "../types";

export interface VideoParticipant {
  id: string;
  user: SneakyUser;
  role: string;
  isLocal: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  videoTrack?: any;
  audioTrack?: any;
}

interface VideoGridProps {
  participants: VideoParticipant[];
  activeSpeakers: Set<string>;
  isHost: boolean;
  onParticipantPress?: (participant: VideoParticipant) => void;
}

// ── Single video tile ─────────────────────────────────────────────

// ── Animated sound bars for speaking indicator ────────────────────

const SpeakingBars = memo(function SpeakingBars() {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0.2,
            duration,
            useNativeDriver: false,
          }),
        ]),
      );
    const a1 = animate(bar1, 320);
    const a2 = animate(bar2, 240);
    const a3 = animate(bar3, 380);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [bar1, bar2, bar3]);

  const barStyle = (anim: Animated.Value) => ({
    width: 3,
    borderRadius: 1.5,
    backgroundColor: "#3FDCFF",
    height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 14] }),
  });

  return (
    <View style={styles.speakingBars}>
      <Animated.View style={barStyle(bar1)} />
      <Animated.View style={barStyle(bar2)} />
      <Animated.View style={barStyle(bar3)} />
    </View>
  );
});

// ── Single video tile ─────────────────────────────────────────────

const VideoTile = memo(function VideoTile({
  participant,
  isSpeaking,
  tileWidth,
  tileHeight,
  isHost,
  onPress,
}: {
  participant: VideoParticipant;
  isSpeaking: boolean;
  tileWidth: number;
  tileHeight: number;
  isHost: boolean;
  onPress?: () => void;
}) {
  const { user, isCameraOn, isMicOn, videoTrack, isLocal, role } = participant;
  const hasStream = videoTrack?.stream;
  const showVideo = isCameraOn && hasStream;
  const isAnon = user.isAnonymous;

  // Animated glow for speaking
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: isSpeaking ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isSpeaking, glowAnim]);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "#3FDCFF"],
  });
  const borderWidth = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2.5],
  });

  return (
    <Animated.View
      style={[
        styles.tileOuter,
        { width: tileWidth, height: tileHeight, borderColor, borderWidth },
      ]}
    >
      <Pressable
        onLongPress={onPress}
        delayLongPress={300}
        style={[styles.tile, { width: "100%", height: "100%" }]}
      >
        {showVideo ? (
          <RTCView
            mediaStream={videoTrack.stream}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={isLocal}
          />
        ) : (
          <View style={styles.avatarContainer}>
            {isAnon ? (
              <View style={styles.anonAvatar}>
                <EyeOff size={32} color="#6B7280" />
              </View>
            ) : (
              <Avatar
                uri={user.avatar}
                username={user.username}
                size={Math.min(tileWidth * 0.4, 72)}
                variant="roundedSquare"
              />
            )}
          </View>
        )}

        {/* Overlay gradient at bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={styles.bottomGradient}
        />

        {/* Name + badges */}
        <View style={styles.nameRow}>
          {role === "host" && (
            <View style={styles.hostBadge}>
              <Crown size={8} color="#fff" />
            </View>
          )}
          {role === "co-host" && (
            <View style={styles.coHostBadge}>
              <Text style={styles.roleBadgeText}>CO</Text>
            </View>
          )}
          <Text style={styles.nameText} numberOfLines={1}>
            {isLocal ? "You" : user.displayName || user.username}
          </Text>
          {user.isVerified && (
            <BadgeCheck size={10} color="#FF6DC1" fill="#FF6DC1" />
          )}
        </View>

        {/* Mic indicator + speaking bars */}
        <View style={styles.micBadge}>
          {isSpeaking ? (
            <SpeakingBars />
          ) : isMicOn ? (
            <Mic size={12} color="#fff" />
          ) : (
            <MicOff size={12} color="#EF4444" />
          )}
        </View>

        {/* Camera off indicator */}
        {!isCameraOn && (
          <View style={styles.cameraOffBadge}>
            <VideoOff size={12} color="#9CA3AF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ── Grid layout calculator ────────────────────────────────────────

function getGridLayout(
  count: number,
  screenWidth: number,
  screenHeight: number,
) {
  const availableHeight = screenHeight - 200; // header + controls
  const gap = 4;

  if (count === 1) {
    return {
      cols: 1,
      rows: 1,
      tileWidth: screenWidth - gap * 2,
      tileHeight: availableHeight,
    };
  }
  if (count === 2) {
    return {
      cols: 1,
      rows: 2,
      tileWidth: screenWidth - gap * 2,
      tileHeight: (availableHeight - gap) / 2,
    };
  }
  if (count <= 4) {
    const cols = 2;
    const rows = Math.ceil(count / cols);
    const tileWidth = (screenWidth - gap * 3) / cols;
    const tileHeight = (availableHeight - gap * (rows + 1)) / rows;
    return { cols, rows, tileWidth, tileHeight };
  }
  if (count <= 6) {
    const cols = 2;
    const rows = Math.ceil(count / cols);
    const tileWidth = (screenWidth - gap * 3) / cols;
    const tileHeight = (availableHeight - gap * (rows + 1)) / rows;
    return { cols, rows, tileWidth, tileHeight };
  }
  // 7+ participants: 3 columns, scrollable
  const cols = 3;
  const tileWidth = (screenWidth - gap * 4) / cols;
  const tileHeight = tileWidth * 1.2;
  return { cols, rows: Math.ceil(count / cols), tileWidth, tileHeight };
}

// ── Main grid component ───────────────────────────────────────────

export function VideoGrid({
  participants,
  activeSpeakers,
  isHost,
  onParticipantPress,
}: VideoGridProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const count = participants.length;

  const { cols, tileWidth, tileHeight } = useMemo(
    () => getGridLayout(count, screenWidth, screenHeight),
    [count, screenWidth, screenHeight],
  );

  if (count === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Waiting for participants...</Text>
      </View>
    );
  }

  // Build rows
  const rows: VideoParticipant[][] = [];
  for (let i = 0; i < participants.length; i += cols) {
    rows.push(participants.slice(i, i + cols));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((p) => (
            <VideoTile
              key={p.id}
              participant={p}
              isSpeaking={activeSpeakers.has(p.user.id)}
              tileWidth={tileWidth}
              tileHeight={tileHeight}
              isHost={isHost}
              onPress={
                isHost && !p.isLocal ? () => onParticipantPress?.(p) : undefined
              }
            />
          ))}
          {/* Fill empty cells in last row */}
          {row.length < cols &&
            Array.from({ length: cols - row.length }).map((_, i) => (
              <View
                key={`empty-${i}`}
                style={{ width: tileWidth, height: tileHeight }}
              />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    gap: 4,
    padding: 4,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  tileOuter: {
    borderRadius: 20,
    overflow: "hidden",
  },
  tile: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  avatarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  anonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  nameRow: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  nameText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  hostBadge: {
    backgroundColor: "#FC253A",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  coHostBadge: {
    backgroundColor: "#8A40CF",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  micBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOffBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 4,
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
  },
  speakingBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 14,
  },
});
