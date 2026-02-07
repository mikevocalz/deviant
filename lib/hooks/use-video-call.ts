/**
 * Video Call Hook - Fishjam SDK
 *
 * Manages video calls using Fishjam Cloud for WebRTC.
 * Supports 1:1 and group calls via the same edge functions as Sneaky Lynk rooms.
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
  roomId: string | null;
  localStream: any | null;
  participants: Participant[];
  speakerId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
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

  const [state, setState] = useState<VideoCallState>({
    isConnected: false,
    isInCall: false,
    roomId: null,
    localStream: null,
    participants: [],
    speakerId: null,
    isMuted: false,
    isVideoOff: false,
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
    const remoteParticipants: Participant[] = peers.map((peer: any) => ({
      oderId: peer.metadata?.userId ?? peer.id,
      username: peer.metadata?.username ?? "?",
      isMuted: !peer.audioTrack,
      isVideoOff: !peer.videoTrack,
      stream: peer.videoTrack?.stream ?? peer.audioTrack?.stream ?? undefined,
    }));
    setState((s) => ({ ...s, participants: remoteParticipants }));
  }, [peers]);

  // Connect — no-op, Fishjam connects via joinRoom
  const connect = useCallback(async () => {
    console.log("[VideoCall] Ready (Fishjam)");
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    leaveRoomRef.current();
    setState((s) => ({ ...s, isConnected: false }));
  }, []);

  // Create a new call
  const createCall = useCallback(
    async (participantIds: string[], isGroup: boolean = false) => {
      try {
        const title = isGroup
          ? `Group Call (${participantIds.length + 1})`
          : "Video Call";

        const createResult = await videoApi.createRoom({
          title,
          maxParticipants: Math.max(participantIds.length + 1, 10),
        });

        if (!createResult.ok || !createResult.data) {
          setState((s) => ({
            ...s,
            error: createResult.error?.message || "Failed to create call",
          }));
          return;
        }

        const newRoomId = createResult.data.room.id;

        // Join the room we just created
        const joinResult = await videoApi.joinRoom(newRoomId);
        if (!joinResult.ok || !joinResult.data) {
          setState((s) => ({
            ...s,
            error: joinResult.error?.message || "Failed to join call",
          }));
          return;
        }

        const { token, user: joinedUser } = joinResult.data;

        await joinRoomRef.current({
          peerToken: token,
          peerMetadata: {
            userId: joinedUser.id,
            username: joinedUser.username,
            avatar: joinedUser.avatar,
          },
        });

        setState((s) => ({ ...s, roomId: newRoomId, isInCall: true }));
        console.log("[VideoCall] Call created and joined:", newRoomId);
      } catch (err: any) {
        console.error("[VideoCall] Create call error:", err);
        setState((s) => ({
          ...s,
          error: err.message || "Failed to create call",
        }));
      }
    },
    [],
  );

  // Join an existing call
  const joinCall = useCallback(async (roomId: string) => {
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

      await joinRoomRef.current({
        peerToken: token,
        peerMetadata: {
          userId: joinedUser.id,
          username: joinedUser.username,
          avatar: joinedUser.avatar,
        },
      });

      setState((s) => ({
        ...s,
        roomId,
        isInCall: true,
        incomingCall: null,
      }));
      console.log("[VideoCall] Joined call:", roomId);
    } catch (err: any) {
      console.error("[VideoCall] Join call error:", err);
      setState((s) => ({ ...s, error: err.message || "Failed to join call" }));
    }
  }, []);

  // Leave current call
  const leaveCall = useCallback(() => {
    leaveRoomRef.current();
    setState((s) => ({
      ...s,
      isInCall: false,
      roomId: null,
      localStream: null,
      participants: [],
      speakerId: null,
    }));
  }, []);

  // Decline incoming call
  const declineCall = useCallback(() => {
    setState((s) => ({ ...s, incomingCall: null }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const mic = micRef.current;
    if (mic.isMicrophoneOn) {
      mic.toggleMicrophone();
    } else {
      mic.toggleMicrophone();
    }
    setState((s) => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const cam = cameraRef.current;
    cam.toggleCamera();
    setState((s) => ({ ...s, isVideoOff: !s.isVideoOff }));
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    const cam = cameraRef.current;
    if (typeof cam.switchCamera === "function") {
      cam.switchCamera();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoomRef.current();
    };
  }, []);

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
  };
}
