/**
 * DevHud — Debug overlay for call screen (DEV only).
 *
 * Shows: role, phase, remote peer count, speaker/mic state,
 * audio session active, remote audio tracks, local audio published.
 */

import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { audioSession } from "@/src/services/calls/audioSession";
import type { CallUiMode } from "./deriveCallUiMode";
import type { Participant } from "@/src/video/types";

export interface DevHudProps {
  mode: CallUiMode;
  callRole: string;
  callPhase: string;
  participants: Participant[];
  isSpeakerOn: boolean;
  isMuted: boolean;
  isAudioMode: boolean;
  hasLocalVideo: boolean;
  hasRemoteVideo: boolean;
}

export function DevHud({
  mode,
  callRole,
  callPhase,
  participants,
  isSpeakerOn,
  isMuted,
  isAudioMode,
  hasLocalVideo,
  hasRemoteVideo,
}: DevHudProps) {
  if (!__DEV__) return null;

  const insets = useSafeAreaInsets();
  const audioState = audioSession.getState();
  const remotePeer = participants[0];
  const remoteAudioCount = participants.filter((p) => p.isMicOn).length;

  return (
    <View style={[styles.container, { top: insets.top + 44 }]}>
      <Text style={styles.line1}>
        {callRole}/{callPhase} → {mode}
      </Text>
      <Text style={styles.line1}>
        rem={participants.length} | rAud={remoteAudioCount} | spk=
        {isSpeakerOn ? "Y" : "N"} | mic={isMuted ? "OFF" : "ON"}
      </Text>
      <Text style={styles.line2}>
        audioSess={audioState.isActive ? "ON" : "OFF"} | hwMute=
        {audioState.isMicMuted ? "Y" : "N"} | hwSpk=
        {audioState.isSpeakerOn ? "Y" : "N"}
      </Text>
      {!isAudioMode && (
        <Text style={styles.line2}>
          lVid={hasLocalVideo ? "Y" : "N"} | rVid={hasRemoteVideo ? "Y" : "N"}
          {remotePeer
            ? ` | rMic=${remotePeer.isMicOn ? "Y" : "N"} rCam=${remotePeer.isCameraOn ? "Y" : "N"}`
            : ""}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 4,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  line1: {
    color: "#4ade80",
    fontSize: 10,
    fontFamily: "monospace",
  },
  line2: {
    color: "#facc15",
    fontSize: 10,
    fontFamily: "monospace",
  },
});
