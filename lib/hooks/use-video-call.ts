/**
 * Video Call Hook - WebRTC + Socket.IO
 *
 * Manages WebRTC peer connections and Socket.IO signaling for video calls.
 * Supports 1:1 and group calls.
 *
 * Architecture inspired by:
 * - https://medium.com/@ashraz.developer/building-a-cross-platform-video-chat-app-with-react-native-webrtc-and-socket-io-b8fcb598805c
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getPayloadBaseUrl } from "@/lib/api-config";

// Dynamic imports for WebRTC and Socket.IO to handle missing dependencies gracefully
let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;
let mediaDevices: any;
let MediaStream: any;
let io: any;
type Socket = any;

// Try to import WebRTC
try {
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  MediaStream = webrtc.MediaStream;
} catch (e) {
  console.warn("[VideoCall] react-native-webrtc not available");
}

// Try to import Socket.IO
try {
  const socketIO = require("socket.io-client");
  io = socketIO.io;
} catch (e) {
  console.warn("[VideoCall] socket.io-client not available");
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export interface Participant {
  oderId: string;
  username: string;
  isMuted: boolean;
  isVideoOff: boolean;
  stream?: any; // MediaStream from react-native-webrtc
}

export interface VideoCallState {
  isConnected: boolean;
  isInCall: boolean;
  roomId: string | null;
  localStream: any | null; // MediaStream from react-native-webrtc
  participants: Participant[];
  speakerId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  incomingCall: { roomId: string; callerId: string; isGroup: boolean } | null;
  error: string | null;
}

export function useVideoCall() {
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

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

  // Initialize socket connection
  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    const API_URL = getPayloadBaseUrl();
    console.log("[VideoCall] Connecting to socket server:", API_URL);

    // Get JWT token for authentication
    const { Platform } = require("react-native");
    const SecureStore =
      Platform.OS === "web" ? null : require("expo-secure-store");
    let token: string | null = null;

    if (Platform.OS === "web") {
      token =
        typeof window !== "undefined"
          ? localStorage.getItem("dvnt_auth_token")
          : null;
    } else {
      token = await SecureStore.getItemAsync("dvnt_auth_token");
    }

    if (!token) {
      setState((s) => ({ ...s, error: "Not authenticated" }));
      return;
    }

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[VideoCall] Socket connected");
      setState((s) => ({ ...s, isConnected: true, error: null }));
    });

    socket.on("disconnect", () => {
      console.log("[VideoCall] Socket disconnected");
      setState((s) => ({ ...s, isConnected: false }));
    });

    socket.on("connect_error", (error: any) => {
      console.error("[VideoCall] Socket connection error:", error.message);
      setState((s) => ({ ...s, error: error.message }));
    });

    // Call events
    socket.on("call:created", handleCallCreated);
    socket.on("call:joined", handleCallJoined);
    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:participant:joined", handleParticipantJoined);
    socket.on("call:participant:left", handleParticipantLeft);
    socket.on("call:participant:updated", handleParticipantUpdated);
    socket.on("call:speaker:changed", handleSpeakerChanged);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:error", handleCallError);

    socketRef.current = socket;
  }, []);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState((s) => ({ ...s, isConnected: false }));
  }, []);

  // Get local media stream
  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      localStreamRef.current = stream;
      setState((s) => ({ ...s, localStream: stream }));
      return stream;
    } catch (error: any) {
      console.error("[VideoCall] Error getting local stream:", error);
      setState((s) => ({ ...s, error: "Failed to access camera/microphone" }));
      return null;
    }
  }, []);

  // Create a new call
  const createCall = useCallback(
    async (participantIds: string[], isGroup: boolean = false) => {
      if (!socketRef.current?.connected) {
        await connect();
      }

      const stream = await getLocalStream();
      if (!stream) return;

      const roomId = `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      socketRef.current?.emit("call:create", {
        roomId,
        isGroup,
        participantIds,
      });

      setState((s) => ({ ...s, roomId, isInCall: true }));
    },
    [connect, getLocalStream],
  );

  // Join an existing call
  const joinCall = useCallback(
    async (roomId: string) => {
      if (!socketRef.current?.connected) {
        await connect();
      }

      const stream = await getLocalStream();
      if (!stream) return;

      socketRef.current?.emit("call:join", { roomId });
      setState((s) => ({ ...s, roomId, isInCall: true, incomingCall: null }));
    },
    [connect, getLocalStream],
  );

  // Leave current call
  const leaveCall = useCallback(() => {
    const { roomId } = state;
    if (!roomId) return;

    socketRef.current?.emit("call:leave", { roomId });

    // Clean up peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setState((s) => ({
      ...s,
      isInCall: false,
      roomId: null,
      localStream: null,
      participants: [],
      speakerId: null,
    }));
  }, [state.roomId]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    setState((s) => ({ ...s, incomingCall: null }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        setState((s) => ({ ...s, isMuted }));

        if (state.roomId) {
          socketRef.current?.emit("call:mute:toggle", {
            roomId: state.roomId,
            isMuted,
          });
        }
      }
    }
  }, [state.roomId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const isVideoOff = !videoTrack.enabled;
        setState((s) => ({ ...s, isVideoOff }));

        if (state.roomId) {
          socketRef.current?.emit("call:video:toggle", {
            roomId: state.roomId,
            isVideoOff,
          });
        }
      }
    }
  }, [state.roomId]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (
        videoTrack &&
        typeof (videoTrack as any)._switchCamera === "function"
      ) {
        (videoTrack as any)._switchCamera();
      }
    }
  }, []);

  // Add participant to call
  const addParticipant = useCallback(
    (participantId: string) => {
      if (!state.roomId) return;
      socketRef.current?.emit("call:add-participant", {
        roomId: state.roomId,
        participantId,
      });
    },
    [state.roomId],
  );

  // Set speaker (for group calls)
  const setSpeaker = useCallback(
    (speakerId: string) => {
      if (!state.roomId) return;
      socketRef.current?.emit("call:speaker:set", {
        roomId: state.roomId,
        speakerId,
      });
    },
    [state.roomId],
  );

  // ==================== Socket Event Handlers ====================

  const handleCallCreated = useCallback((data: any) => {
    console.log("[VideoCall] Call created:", data);
    setState((s) => ({
      ...s,
      roomId: data.roomId,
      speakerId: data.speakerId,
      participants: data.participants,
    }));
  }, []);

  const handleCallJoined = useCallback(
    (data: any) => {
      console.log("[VideoCall] Joined call:", data);
      setState((s) => ({
        ...s,
        roomId: data.roomId,
        speakerId: data.speakerId,
        participants: data.participants,
      }));

      // Create peer connections with existing participants
      data.participants.forEach((p: Participant) => {
        if (p.oderId !== user?.id) {
          createPeerConnection(p.oderId);
        }
      });
    },
    [user?.id],
  );

  const handleIncomingCall = useCallback((data: any) => {
    console.log("[VideoCall] Incoming call:", data);
    setState((s) => ({
      ...s,
      incomingCall: {
        roomId: data.roomId,
        callerId: data.callerId,
        isGroup: data.isGroup,
      },
    }));
  }, []);

  const handleParticipantJoined = useCallback((data: any) => {
    console.log("[VideoCall] Participant joined:", data);
    setState((s) => ({
      ...s,
      participants: [...s.participants, data],
    }));

    // Create peer connection and send offer
    createPeerConnection(data.oderId, true);
  }, []);

  const handleParticipantLeft = useCallback((data: any) => {
    console.log("[VideoCall] Participant left:", data);

    // Close peer connection
    const pc = peerConnectionsRef.current.get(data.oderId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(data.oderId);
    }

    setState((s) => ({
      ...s,
      participants: s.participants.filter((p) => p.oderId !== data.oderId),
    }));
  }, []);

  const handleParticipantUpdated = useCallback((data: any) => {
    setState((s) => ({
      ...s,
      participants: s.participants.map((p) =>
        p.oderId === data.oderId ? { ...p, ...data } : p,
      ),
    }));
  }, []);

  const handleSpeakerChanged = useCallback((data: any) => {
    setState((s) => ({ ...s, speakerId: data.speakerId }));
  }, []);

  const handleOffer = useCallback(async (data: any) => {
    console.log("[VideoCall] Received offer from:", data.fromUserId);

    let pc = peerConnectionsRef.current.get(data.fromUserId);
    if (!pc) {
      pc = createPeerConnection(data.fromUserId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current?.emit("call:answer", {
      roomId: data.roomId,
      targetUserId: data.fromUserId,
      answer,
    });
  }, []);

  const handleAnswer = useCallback(async (data: any) => {
    console.log("[VideoCall] Received answer from:", data.fromUserId);

    const pc = peerConnectionsRef.current.get(data.fromUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (data: any) => {
    const pc = peerConnectionsRef.current.get(data.fromUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }, []);

  const handleCallError = useCallback((data: any) => {
    console.error("[VideoCall] Call error:", data.error);
    setState((s) => ({ ...s, error: data.error }));
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = useCallback(
    (targetUserId: string, createOffer: boolean = false): RTCPeerConnection => {
      console.log("[VideoCall] Creating peer connection for:", targetUserId);

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event: any) => {
        if (event.candidate && state.roomId) {
          socketRef.current?.emit("call:ice-candidate", {
            roomId: state.roomId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event: any) => {
        console.log("[VideoCall] Received remote track from:", targetUserId);
        const remoteStream = event.streams[0];

        setState((s) => ({
          ...s,
          participants: s.participants.map((p) =>
            p.oderId === targetUserId ? { ...p, stream: remoteStream } : p,
          ),
        }));
      };

      pc.onconnectionstatechange = () => {
        console.log("[VideoCall] Connection state:", pc.connectionState);
      };

      peerConnectionsRef.current.set(targetUserId, pc);

      // Create and send offer if needed
      if (createOffer) {
        (async () => {
          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);

          socketRef.current?.emit("call:offer", {
            roomId: state.roomId,
            targetUserId,
            offer,
          });
        })();
      }

      return pc;
    },
    [state.roomId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveCall();
      disconnect();
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
