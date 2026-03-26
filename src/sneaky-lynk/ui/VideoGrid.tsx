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
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Animated as RNAnimated,
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
  Users,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import type { SneakyUser } from "../types";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

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
  const bar1 = useRef(new RNAnimated.Value(0.3)).current;
  const bar2 = useRef(new RNAnimated.Value(0.6)).current;
  const bar3 = useRef(new RNAnimated.Value(0.4)).current;

  useEffect(() => {
    const animate = (value: RNAnimated.Value, duration: number) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(value, {
            toValue: 1,
            duration,
            useNativeDriver: false,
          }),
          RNAnimated.timing(value, {
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

  const barStyle = (anim: RNAnimated.Value) => ({
    width: 3,
    borderRadius: 1.5,
    backgroundColor: "#3FDCFF",
    height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 14] }),
  });

  return (
    <View style={styles.speakingBars}>
      <RNAnimated.View style={barStyle(bar1)} />
      <RNAnimated.View style={barStyle(bar2)} />
      <RNAnimated.View style={barStyle(bar3)} />
    </View>
  );
});

// ── Single video tile ─────────────────────────────────────────────

const VideoTile = memo(function VideoTile({
  participant,
  isSpeaking,
  tileWidth,
  tileHeight,
  onPress,
}: {
  participant: VideoParticipant;
  isSpeaking: boolean;
  tileWidth: number;
  tileHeight: number;
  onPress?: () => void;
}) {
  const { user, isCameraOn, isMicOn, videoTrack, isLocal, role } = participant;
  const hasStream = videoTrack?.stream;
  const showVideo = isCameraOn && hasStream;
  const isAnon = user.isAnonymous;
  const label = user.anonLabel || user.username || user.displayName || "Guest";
  const showHostIdentityPill = role === "host";

  // Animated glow for speaking
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(glowAnim, {
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
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(18).stiffness(180)}
      style={{ width: tileWidth, height: tileHeight }}
    >
      <RNAnimated.View
        style={[
          styles.tileOuter,
          {
            width: tileWidth,
            height: tileHeight,
            borderColor,
            borderWidth,
            shadowColor: isSpeaking ? "#3FDCFF" : "#000",
            shadowOpacity: isSpeaking ? 0.32 : 0.14,
            shadowRadius: isSpeaking ? 18 : 12,
            shadowOffset: { width: 0, height: 10 },
          },
        ]}
      >
        <Pressable
          onLongPress={onPress}
          delayLongPress={260}
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
            <LinearGradient
              colors={["#131922", "#0D1117", "#06080D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarContainer}
            >
              <View style={styles.avatarHalo} />
              {isAnon ? (
                <View style={styles.anonAvatar}>
                  <EyeOff size={32} color="#A8B2C6" />
                </View>
              ) : (
                <Avatar
                  uri={user.avatar}
                  username={user.username}
                  size={Math.min(tileWidth * 0.4, 78)}
                  variant="roundedSquare"
                />
              )}
              <Text style={styles.cameraOffText}>
                {isCameraOn ? "Live video" : "Audio only"}
              </Text>
            </LinearGradient>
          )}

          <LinearGradient
            colors={[
              "rgba(0,0,0,0.02)",
              "rgba(0,0,0,0.18)",
              "rgba(0,0,0,0.82)",
            ]}
            style={styles.bottomGradient}
          />

          <View style={styles.topBadgeRow}>
            {!isCameraOn && (
              <View style={styles.stateBadge}>
                <VideoOff size={11} color="#D1D5DB" />
                <Text style={styles.stateBadgeText}>Audio</Text>
              </View>
            )}
            <View style={styles.topBadgeRight}>
              {showHostIdentityPill ? (
                <View style={styles.hostIdentityPill}>
                  <View style={styles.hostBadge}>
                    <Crown size={8} color="#fff" />
                  </View>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {label}
                  </Text>
                  {user.isVerified && (
                    <BadgeCheck size={10} color="#7DD3FC" fill="#7DD3FC" />
                  )}
                </View>
              ) : null}
              {isLocal && !showHostIdentityPill && (
                <View style={styles.selfBadge}>
                  <Text style={styles.selfBadgeText}>You</Text>
                </View>
              )}
            </View>
          </View>

          {!showHostIdentityPill && (
            <View style={styles.namePill}>
              {role === "co-host" && (
                <View style={styles.coHostBadge}>
                  <Text style={styles.roleBadgeText}>CO</Text>
                </View>
              )}
              <Text style={styles.nameText} numberOfLines={1}>
                {label}
              </Text>
              {user.isVerified && (
                <BadgeCheck size={10} color="#7DD3FC" fill="#7DD3FC" />
              )}
            </View>
          )}

          <View style={styles.micBadge}>
            {isSpeaking ? (
              <SpeakingBars />
            ) : isMicOn ? (
              <Mic size={12} color="#fff" />
            ) : (
              <MicOff size={12} color="#F87171" />
            )}
          </View>
        </Pressable>
      </RNAnimated.View>
    </Animated.View>
  );
});

// ── Grid layout calculator ────────────────────────────────────────

function getGridLayout(
  count: number,
  screenWidth: number,
  screenHeight: number,
) {
  const availableHeight = screenHeight - 178;
  const gap = 6;

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
        <LinearGradient
          colors={["rgba(28,33,43,0.96)", "rgba(9,12,18,0.96)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyCard}
        >
          <Users size={22} color="#7DD3FC" />
          <Text style={styles.emptyText}>Waiting for participants...</Text>
          <Text style={styles.emptySubtext}>
            New people will slide into the room as soon as they connect.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Build rows
  const rows: VideoParticipant[][] = [];
  for (let i = 0; i < participants.length; i += cols) {
    rows.push(participants.slice(i, i + cols));
  }

  const content = (
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
              onPress={
                isHost && !p.isLocal ? () => onParticipantPress?.(p) : undefined
              }
            />
          ))}
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

  if (count > 6) {
    return (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    gap: 6,
    padding: 6,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  tileOuter: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0A0E15",
  },
  tile: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#10151D",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#11151E",
    gap: 12,
  },
  avatarHalo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(125,211,252,0.08)",
  },
  anonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOffText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
  },
  topBadgeRow: {
    position: "absolute",
    top: 9,
    left: 9,
    right: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBadgeRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(4,8,16,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stateBadgeText: {
    color: "#E5E7EB",
    fontSize: 10,
    fontWeight: "700",
  },
  selfBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.18)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.24)",
  },
  selfBadgeText: {
    color: "#E0F2FE",
    fontSize: 10,
    fontWeight: "700",
  },
  hostIdentityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    maxWidth: 150,
    backgroundColor: "rgba(4,8,16,0.7)",
    borderWidth: 1,
    borderColor: "rgba(252,37,58,0.24)",
  },
  namePill: {
    position: "absolute",
    left: 9,
    right: 42,
    bottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: "rgba(4,8,16,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  nameText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
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
    borderRadius: 6,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  micBadge: {
    position: "absolute",
    bottom: 10,
    right: 9,
    backgroundColor: "rgba(4,8,16,0.72)",
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "700",
  },
  emptySubtext: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
  },
  speakingBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 14,
  },
});
