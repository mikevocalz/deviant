/**
 * InCallVideoStage — FaceTime-style in-call video layout.
 *
 * - Remote video: fullscreen (cover)
 * - Local preview: small draggable bubble (top-right)
 * - Duration badge: top-center
 * - Controls: floating bottom bar (rendered by parent)
 */

import { useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RTCView,
  RTCPIPView,
} from "@fishjam-cloud/react-native-client";
import { Image } from "expo-image";
import { LocalPreviewBubble } from "../LocalPreviewBubble";

export interface InCallVideoStageProps {
  remoteVideoStream: MediaStream | null;
  hasRemoteVideo: boolean;
  localStream: MediaStream | null;
  hasLocalVideo: boolean;
  recipientName: string;
  recipientAvatar?: string;
  callDuration: number;
  pipViewRef: React.RefObject<any>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function InCallVideoStage({
  remoteVideoStream,
  hasRemoteVideo,
  localStream,
  hasLocalVideo,
  recipientName,
  recipientAvatar,
  callDuration,
  pipViewRef,
}: InCallVideoStageProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Remote video — fullscreen */}
      {hasRemoteVideo && remoteVideoStream ? (
        <RTCPIPView
          ref={pipViewRef}
          mediaStream={remoteVideoStream}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
        />
      ) : (
        // Remote video not yet available — show avatar on black
        <View style={styles.avatarFallback}>
          {recipientAvatar ? (
            <Image
              source={{ uri: recipientAvatar }}
              style={styles.avatarLarge}
            />
          ) : (
            <View style={[styles.avatarLarge, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {recipientName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.avatarName}>{recipientName}</Text>
        </View>
      )}

      {/* Local preview bubble */}
      {hasLocalVideo && localStream && (
        <LocalPreviewBubble stream={localStream} />
      )}

      {/* Duration badge */}
      {callDuration > 0 && (
        <View style={[styles.durationBadge, { top: insets.top + 8 }]}>
          <Text style={styles.durationText}>
            {formatDuration(callDuration)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "700",
  },
  avatarName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 12,
  },
  durationBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  durationText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "monospace",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
});
