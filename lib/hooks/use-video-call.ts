/**
 * Video Call Hook - Fishjam SDK
 *
 * Manages video calls using Fishjam Cloud for WebRTC.
 * Supports 1:1 and group calls, audio-only and video modes.
 * Supports switching between audio and video mid-call.
 *
 * Requires FishjamProvider to be wrapping the call screen.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-native-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { videoApi } from "@/src/video/api";
import { callSignalsApi, type CallSignal } from "@/lib/api/call-signals";

export type CallType = "audio" | "video";

export interface Participant {
  oderId: string;
  username: string;
  isMuted: boolean;
  isVideoOff: boolean;
  stream?: any;
}

export interface VideoCallState {
  isConnected: boolean;
  isInCall: boolean;
  callType: CallType;
  roomId: string | null;
  chatId: string | null;
  localStream: any | null;
  participants: Participant[];
  speakerId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callEnded: boolean;
  callDuration: number;
  incomingCall: { roomId: string; callerId: string; isGroup: boolean } | null;
  error: string | null;
}

export function useVideoCall() {
  const user = useAuthStore((s) => s.user);
  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const cameraHook = useCamera();
  const microphoneHook = useMicrophone();
  const peers = usePeers();

  const joinRoomRef = useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;
  const cameraRef = useRef(cameraHook);
  cameraRef.current = cameraHook;
  const micRef = useRef(microphoneHook);
  micRef.current = microphoneHook;
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const [state, setState] = useState<VideoCallState>({
    isConnected: false,
    isInCall: false,
    callType: "video",
    roomId: null,
    chatId: null,
    localStream: null,
    participants: [],
    speakerId: null,
    isMuted: false,
    isVideoOff: false,
    callEnded: false,
    callDuration: 0,
    incomingCall: null,
    error: null,
  });

  // Sync connection status from Fishjam
  useEffect(() => {
    setState((s) => ({
      ...s,
      isConnected: peerStatus === "connected",
    }));
  }, [peerStatus]);

  // Sync local camera stream
  useEffect(() => {
    setState((s) => ({
      ...s,
      localStream: cameraHook.cameraStream ?? null,
    }));
  }, [cameraHook.cameraStream]);

  // Sync remote peers into participants
  useEffect(() => {
    const remoteParticipants: Participant[] = (peers.remotePeers || []).map(
      (peer: any) => ({
        oderId: peer.metadata?.userId ?? peer.id,
        username: peer.metadata?.username ?? "?",
        isMuted: !peer.audioTrack,
        isVideoOff: !peer.videoTrack,
        stream: peer.videoTrack?.stream ?? peer.audioTrack?.stream ?? undefined,
      }),
    );
    setState((s) => ({ ...s, participants: remoteParticipants }));
  }, [peers]);

  // Start call duration timer
  const startDurationTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        setState((s) => ({
          ...s,
          callDuration: Math.floor(
            (Date.now() - callStartTimeRef.current!) / 1000,
          ),
        }));
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Find front camera device ID
  const getFrontCameraId = useCallback((): string | undefined => {
    const cam = cameraRef.current;
    const devices = cam.cameraDevices || [];
    const front = devices.find(
      (d: any) =>
        d.label?.toLowerCase().includes("front") ||
        d.deviceId?.includes("front"),
    );
    return front?.deviceId;
  }, []);

  // Connect — no-op, Fishjam connects via joinRoom
  const connect = useCallback(async () => {
    console.log("[VideoCall] Ready (Fishjam)");
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    leaveRoomRef.current();
    setState((s) => ({ ...s, isConnected: false }));
  }, []);

  // Start media based on call type
  const startMedia = useCallback(
    async (type: CallType) => {
      try {
        // Always start microphone
        await micRef.current.startMicrophone();
        console.log("[VideoCall] Mic started");

        if (type === "video") {
          // Try to select front camera first
          const frontId = getFrontCameraId();
          await cameraRef.current.startCamera(frontId || null);
          console.log(
            "[VideoCall] Camera started (front):",
            !!cameraRef.current.cameraStream,
          );
        }
      } catch (mediaErr) {
        console.warn("[VideoCall] Failed to start media:", mediaErr);
      }
    },
    [getFrontCameraId],
  );

  // Create a new call
  const createCall = useCallback(
    async (
      participantIds: string[],
      isGroup: boolean = false,
      callType: CallType = "video",
      chatId?: string,
    ) => {
      try {
        const title = isGroup
          ? `Group Call (${participantIds.length + 1})`
          : callType === "audio"
            ? "Audio Call"
            : "Video Call";

        const createResult = await videoApi.createRoom({
          title,
          maxParticipants: Math.max(participantIds.length + 1, 10),
        });
        console.log(
          "[VideoCall] createRoom result:",
          JSON.stringify(createResult),
        );

        if (!createResult.ok || !createResult.data) {
          setState((s) => ({
            ...s,
            error: createResult.error?.message || "Failed to create call",
          }));
          return;
        }

        const newRoomId = createResult.data.room.id;
        console.log("[VideoCall] Room created, joining:", newRoomId);

        // Join the room we just created
        const joinResult = await videoApi.joinRoom(newRoomId);
        console.log("[VideoCall] joinRoom result:", JSON.stringify(joinResult));

        if (!joinResult.ok || !joinResult.data) {
          setState((s) => ({
            ...s,
            error: joinResult.error?.message || "Failed to join call",
          }));
          return;
        }

        const { token, user: joinedUser } = joinResult.data;
        console.log("[VideoCall] Got Fishjam token, joining peer...");

        await joinRoomRef.current({
          peerToken: token,
          peerMetadata: {
            userId: joinedUser.id,
            username: joinedUser.username,
            avatar: joinedUser.avatar,
          },
        });
        console.log("[VideoCall] Fishjam peer joined, starting media...");

        // Start media based on call type
        await startMedia(callType);

        // Signal the callees so they get a ring notification
        try {
          await callSignalsApi.sendCallSignal({
            roomId: newRoomId,
            callerId: user?.id || "",
            calleeIds: participantIds,
            callerUsername: user?.username || undefined,
            callerAvatar: user?.avatar || undefined,
            isGroup,
            callType,
          });
        } catch (signalErr) {
          console.warn("[VideoCall] Failed to send call signal:", signalErr);
        }

        startDurationTimer();
        setState((s) => ({
          ...s,
          roomId: newRoomId,
          chatId: chatId || null,
          isInCall: true,
          callType,
          isVideoOff: callType === "audio",
          callEnded: false,
          callDuration: 0,
        }));
        console.log("[VideoCall] Call created and joined:", newRoomId);
      } catch (err: any) {
        console.error("[VideoCall] Create call error:", err);
        setState((s) => ({
          ...s,
          error: err.message || "Failed to create call",
        }));
      }
    },
    [user, startMedia, startDurationTimer],
  );

  // Join an existing call
  const joinCall = useCallback(
    async (roomId: string, callType: CallType = "video") => {
      try {
        const joinResult = await videoApi.joinRoom(roomId);
        if (!joinResult.ok || !joinResult.data) {
          setState((s) => ({
            ...s,
            error: joinResult.error?.message || "Failed to join call",
          }));
          return;
        }

        const { token, user: joinedUser } = joinResult.data;
        console.log("[VideoCall] joinCall got token, joining Fishjam peer...");

        await joinRoomRef.current({
          peerToken: token,
          peerMetadata: {
            userId: joinedUser.id,
            username: joinedUser.username,
            avatar: joinedUser.avatar,
          },
        });
        console.log("[VideoCall] Fishjam peer joined, starting media...");

        // Start media based on call type
        await startMedia(callType);

        startDurationTimer();
        setState((s) => ({
          ...s,
          roomId,
          isInCall: true,
          callType,
          isVideoOff: callType === "audio",
          incomingCall: null,
          callEnded: false,
          callDuration: 0,
        }));
        console.log("[VideoCall] Joined call:", roomId);
      } catch (err: any) {
        console.error("[VideoCall] Join call error:", err);
        setState((s) => ({
          ...s,
          error: err.message || "Failed to join call",
        }));
      }
    },
    [startMedia, startDurationTimer],
  );

  // Leave current call
  const leaveCall = useCallback(() => {
    const currentRoomId = state.roomId;

    // End call signals for this room
    if (currentRoomId) {
      callSignalsApi.endCallSignals(currentRoomId).catch(() => {});
    }

    stopDurationTimer();
    leaveRoomRef.current();

    // Show call ended state briefly
    setState((s) => ({
      ...s,
      isInCall: false,
      callEnded: true,
      localStream: null,
      participants: [],
      speakerId: null,
    }));
  }, [state.roomId, stopDurationTimer]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    setState((s) => ({ ...s, incomingCall: null }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    micRef.current.toggleMicrophone();
    setState((s) => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  // Toggle video (also used to upgrade audio call to video)
  const toggleVideo = useCallback(() => {
    const cam = cameraRef.current;
    if (state.isVideoOff) {
      // Turning video ON — if audio-only call, start camera with front facing
      const frontId = getFrontCameraId();
      cam.startCamera(frontId || null).then(() => {
        console.log("[VideoCall] Camera started for video upgrade");
      });
      setState((s) => ({
        ...s,
        isVideoOff: false,
        callType: "video",
      }));
    } else {
      // Turning video OFF
      cam.stopCamera();
      setState((s) => ({
        ...s,
        isVideoOff: true,
      }));
    }
  }, [state.isVideoOff, getFrontCameraId]);

  // Switch camera (front/back) using the SDK's track._switchCamera
  const switchCamera = useCallback(() => {
    const cam = cameraRef.current;
    const stream = cam.cameraStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (
        videoTrack &&
        typeof (videoTrack as any)._switchCamera === "function"
      ) {
        (videoTrack as any)._switchCamera();
        console.log("[VideoCall] Camera switched via _switchCamera");
      } else {
        // Fallback: toggle camera off/on
        cam.toggleCamera().then(() => {
          cam.toggleCamera();
        });
        console.log("[VideoCall] Camera switched via toggle fallback");
      }
    }
  }, []);

  // Add participant to call (placeholder)
  const addParticipant = useCallback((_participantId: string) => {
    console.log("[VideoCall] addParticipant not yet implemented for Fishjam");
  }, []);

  // Set speaker (for group calls)
  const setSpeaker = useCallback((speakerId: string) => {
    setState((s) => ({ ...s, speakerId }));
  }, []);

  // Reset call ended state
  const resetCallEnded = useCallback(() => {
    setState((s) => ({
      ...s,
      callEnded: false,
      roomId: null,
      chatId: null,
      callDuration: 0,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDurationTimer();
      leaveRoomRef.current();
    };
  }, [stopDurationTimer]);

  return {
    ...state,
    connect,
    disconnect,
    createCall,
    joinCall,
    leaveCall,
    declineCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    addParticipant,
    setSpeaker,
    resetCallEnded,
  };
}
