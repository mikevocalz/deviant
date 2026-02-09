/**
 * Video Call Screen — FaceTime-Style
 *
 * Thin wrapper that:
 * 1. Reads navigation params
 * 2. Runs deterministic init (perms → create/join)
 * 3. Delegates ALL rendering to CallScreen orchestrator
 *
 * All UI logic, stage rendering, and controls live in
 * src/features/calls/ui/ — this file is intentionally minimal.
 */

import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoCall, type CallType } from "@/lib/hooks/use-video-call";
import { useMediaPermissions } from "@/src/video/hooks/useMediaPermissions";
import { CT } from "@/src/services/calls/callTrace";
import { CallScreen } from "@/src/features/calls/ui/CallScreen";

export default function VideoCallScreen() {
  const {
    roomId,
    isOutgoing,
    participantIds,
    callType: callTypeParam,
    chatId,
    recipientUsername,
    recipientAvatar,
  } = useLocalSearchParams<{
    roomId?: string;
    isOutgoing?: string;
    participantIds?: string;
    callType?: string;
    chatId?: string;
    recipientUsername?: string;
    recipientAvatar?: string;
  }>();

  const { requestPermissions, openSettings } = useMediaPermissions();
  const { createCall, joinCall } = useVideoCall();

  const initialCallType: CallType =
    callTypeParam === "audio" ? "audio" : "video";

  // ── DETERMINISTIC INIT: perms → room → peer → media ───────────────
  useEffect(() => {
    const initCall = async () => {
      const permsOk = await requestPermissions(initialCallType);
      if (!permsOk) {
        CT.error("LIFECYCLE", "permsDenied", { callType: initialCallType });
        return;
      }
      if (isOutgoing === "true" && participantIds) {
        const ids = participantIds.split(",");
        await createCall(ids, ids.length > 1, initialCallType, chatId);
      } else if (roomId) {
        await joinCall(roomId, initialCallType);
      }
    };
    initCall();
  }, [roomId, isOutgoing, participantIds]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CallScreen
        recipientName={recipientUsername || "Unknown"}
        recipientAvatar={recipientAvatar}
        onOpenSettings={openSettings}
      />
    </View>
  );
}
