import React from "react";
import { View } from "react-native";
import { RTCView } from "@fishjam-cloud/react-native-client";
import type { VideoParticipant } from "./VideoGrid";

interface RemoteAudioLayerProps {
  participants: VideoParticipant[];
}

export function RemoteAudioLayer({ participants }: RemoteAudioLayerProps) {
  const remoteAudioParticipants = participants.filter(
    (participant) => !participant.isLocal && participant.audioTrack?.stream,
  );

  if (remoteAudioParticipants.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0.01,
        overflow: "hidden",
      }}
    >
      {remoteAudioParticipants.map((participant) => (
        <RTCView
          key={`${participant.id}:${participant.audioTrack?.trackId ?? "audio"}`}
          mediaStream={participant.audioTrack.stream}
          style={{ width: 1, height: 1 }}
          objectFit="contain"
          mirror={false}
        />
      ))}
    </View>
  );
}
