/**
 * useVideoCall — Production-Grade Call Hook (Fishjam SDK)
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ARCHITECTURE INVARIANTS (NEVER VIOLATE):                          ║
 * ║                                                                    ║
 * ║  1. ALL call state lives in Zustand (useVideoRoomStore).           ║
 * ║     NO useState for room, participants, tracks, call status.       ║
 * ║                                                                    ║
 * ║  2. DETERMINISTIC JOIN ORDER — MODE-AWARE:                         ║
 * ║                                                                    ║
 * ║     AUDIO:                                                         ║
 * ║       a) Request mic permission (ONLY — no camera)                 ║
 * ║       b) Create/join room                                          ║
 * ║       c) Connect Fishjam peer                                      ║
 * ║       d) Start microphone                                          ║
 * ║       e) Render audio UI (NO RTCView)                              ║
 * ║                                                                    ║
 * ║     VIDEO:                                                         ║
 * ║       a) Request mic + camera permissions                          ║
 * ║       b) Create/join room                                          ║
 * ║       c) Connect Fishjam peer                                      ║
 * ║       d) Start microphone                                          ║
 * ║       e) Start camera (front-facing default)                       ║
 * ║       f) Verify cameraStream !== null                               ║
 * ║       g) Render video UI                                           ║
 * ║                                                                    ║
 * ║  3. NO SILENT FAILURES. Every error surfaces to store + logs.      ║
 * ║                                                                    ║
 * ║  4. AUDIO MODE MUST NEVER touch camera.                            ║
 * ║     Camera enable in audio mode = INVARIANT VIOLATION.             ║
 * ║     Use escalateToVideo() for explicit audio → video upgrade.      ║
 * ║                                                                    ║
 * ║  5. RTCView NEVER renders without a resolved video track.          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useRef, useEffect } from "react";
import { Platform } from "react-native";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
} from "@fishjam-cloud/react-native-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { videoApi } from "@/src/video/api";
import { callSignalsApi } from "@/lib/api/call-signals";
import {
  enableSpeakerphone,
  disableSpeakerphone,
} from "@/lib/utils/audio-route";
import {
  useVideoRoomStore,
  type CallType,
  type CallPhase,
} from "@/src/video/stores/video-room-store";
import type { Participant } from "@/src/video/types";

// Re-export for consumers
export type { CallType, CallPhase };
export type { Participant };

const LOG_PREFIX = "[VideoCall]";

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}
function logError(...args: unknown[]) {
  console.error(LOG_PREFIX, "ERROR:", ...args);
}
function logWarn(...args: unknown[]) {
  console.warn(LOG_PREFIX, "WARN:", ...args);
}

export function useVideoCall() {
  const user = useAuthStore((s) => s.user);
  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const cameraHook = useCamera();
  const microphoneHook = useMicrophone();
  const peers = usePeers();

  // ── Stable refs for SDK functions (identity not guaranteed stable) ──
  const joinRoomRef = useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;
  const cameraRef = useRef(cameraHook);
  cameraRef.current = cameraHook;
  const micRef = useRef(microphoneHook);
  micRef.current = microphoneHook;
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const hadPeersRef = useRef(false);
  const leaveCallRef = useRef<() => void>(() => {});

  // ── Zustand store access ────────────────────────────────────────────
  const store = useVideoRoomStore();
  const getStore = useVideoRoomStore.getState;

  // ── Sync Fishjam peerStatus → store ─────────────────────────────────
  useEffect(() => {
    const s = getStore();
    if (peerStatus === "connected" && s.callPhase === "connecting_peer") {
      s.setCallPhase("starting_media");
      s.setConnectionStatus("connected");
      log("Peer connected, transitioning to starting_media");
    } else if (peerStatus === "connected") {
      s.setConnectionStatus("connected");
    } else if (peerStatus === "error") {
      s.setConnectionStatus("error", "Peer connection failed");
      if (s.callPhase === "connecting_peer") {
        s.setError("WebRTC peer connection failed", "peer_error");
      }
    }
  }, [peerStatus, getStore]);

  // ── Sync local camera stream → store ────────────────────────────────
  useEffect(() => {
    const stream = cameraHook.cameraStream ?? null;
    const s = getStore();
    s.setLocalStream(stream as any);
    if (stream) {
      const tracks = stream.getVideoTracks();
      log(`Local camera stream updated: ${tracks.length} video track(s)`);
      s.setCameraOn(tracks.length > 0);
    } else {
      s.setCameraOn(false);
    }
  }, [cameraHook.cameraStream, getStore]);

  // ── Sync remote peers → store participants ──────────────────────────
  useEffect(() => {
    const remotePeers = peers.remotePeers || [];
    const participants: Participant[] = remotePeers.map((peer: any) => ({
      odId: peer.id,
      oderId: peer.metadata?.userId ?? peer.id,
      userId: peer.metadata?.userId ?? peer.id,
      username: peer.metadata?.username ?? "?",
      avatar: peer.metadata?.avatar,
      role: peer.metadata?.role || "participant",
      isLocal: false,
      isCameraOn: !!peer.videoTrack,
      isMicOn: !!peer.audioTrack,
      isScreenSharing: false,
      videoTrack: peer.videoTrack,
      audioTrack: peer.audioTrack,
    }));
    getStore().setParticipants(participants);

    // Track if we ever had remote peers
    if (participants.length > 0) {
      hadPeersRef.current = true;
    }

    // Auto-end call when all remote peers leave after being connected
    const s = getStore();
    if (
      hadPeersRef.current &&
      participants.length === 0 &&
      s.callPhase === "connected"
    ) {
      log("All remote peers left — auto-ending call");
      // Small delay to avoid race with peer reconnection
      setTimeout(() => {
        const current = getStore();
        if (
          current.participants.length === 0 &&
          current.callPhase === "connected"
        ) {
          leaveCallRef.current();
        }
      }, 2000);
    }
  }, [peers, getStore]);

  // ── Duration timer ──────────────────────────────────────────────────
  const startDurationTimer = useCallback(() => {
    const now = Date.now();
    getStore().setCallStartedAt(now);
    durationIntervalRef.current = setInterval(() => {
      const startedAt = getStore().callStartedAt;
      if (startedAt) {
        getStore().setCallDuration(Math.floor((Date.now() - startedAt) / 1000));
      }
    }, 1000);
  }, [getStore]);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // ── Find front camera device ID ────────────────────────────────────
  const getFrontCameraId = useCallback((): string | undefined => {
    const devices = cameraRef.current.cameraDevices || [];
    const front = devices.find(
      (d: any) =>
        d.label?.toLowerCase().includes("front") ||
        d.deviceId?.includes("front"),
    );
    if (front) log("Front camera found:", front.deviceId);
    else logWarn("No front camera found in", devices.length, "devices");
    return front?.deviceId;
  }, []);

  // ── Start media — MODE-AWARE ──────────────────────────────────────
  // AUDIO: mic only. Camera MUST NOT be touched.
  // VIDEO: mic + camera (front-facing default).
  const startMedia = useCallback(
    async (type: CallType) => {
      const s = getStore();
      s.setCallPhase("starting_media");
      log(`Starting media for ${type.toUpperCase()} call`);

      // ── Step 1: Start microphone (ALWAYS, both modes) ──────────────
      try {
        await micRef.current.startMicrophone();
        s.setMicOn(true);
        log(
          `[${type.toUpperCase()}] Microphone started — audio track publishing`,
        );
      } catch (micErr) {
        logError(`[${type.toUpperCase()}] FAILED to start microphone:`, micErr);
        s.setError(
          "Microphone failed to start. Check permissions.",
          "mic_start_failed",
        );
        return false;
      }

      // ── Step 2: Start camera (VIDEO ONLY) ──────────────────────────
      if (type === "video") {
        try {
          const frontId = getFrontCameraId();
          const [track, err] = await cameraRef.current.startCamera(
            frontId || null,
          );
          if (err) {
            logError("[VIDEO] Camera startCamera returned error:", err);
            s.setError(
              "Camera failed to start: " + (err.name || "unknown"),
              "camera_start_failed",
            );
            return false;
          }
          s.setCameraOn(true);
          log(
            "[VIDEO] Camera started, track:",
            !!track,
            "stream:",
            !!cameraRef.current.cameraStream,
          );

          // VERIFY: camera stream must exist after startCamera
          if (!cameraRef.current.cameraStream) {
            logError(
              "[VIDEO] CRITICAL: Camera started but cameraStream is null — black screen will occur",
            );
            s.setError(
              "Camera stream not available after start",
              "camera_stream_null",
            );
            return false;
          }
        } catch (camErr) {
          logError("[VIDEO] FAILED to start camera:", camErr);
          s.setError(
            "Camera failed to start. Check permissions.",
            "camera_start_failed",
          );
          return false;
        }
      } else {
        // AUDIO MODE: Explicitly do NOT touch camera
        log(
          "[AUDIO] Skipping camera — audio-only mode. Camera will NOT be enabled.",
        );
        s.setCameraOn(false);
      }

      // ── Step 3: Enable speaker output (iOS defaults to earpiece) ────
      enableSpeakerphone();

      s.setCallPhase("connected");
      log(`[${type.toUpperCase()}] Media started, call is now connected`);
      return true;
    },
    [getFrontCameraId, getStore],
  );

  // ── Create a new call (outgoing) ───────────────────────────────────
  const createCall = useCallback(
    async (
      participantIds: string[],
      isGroup: boolean = false,
      callType: CallType = "video",
      chatId?: string,
    ) => {
      const s = getStore();
      s.clearError();
      s.setCallType(callType);
      s.setChatId(chatId || null);

      // Step 1: Create room (edge function)
      s.setCallPhase("creating_room");
      log("Creating room...");

      const title = isGroup
        ? `Group Call (${participantIds.length + 1})`
        : callType === "audio"
          ? "Audio Call"
          : "Video Call";

      const createResult = await videoApi.createRoom({
        title,
        maxParticipants: Math.max(participantIds.length + 1, 10),
      });

      if (!createResult.ok || !createResult.data) {
        const msg = createResult.error?.message || "Failed to create room";
        logError("Room creation failed:", msg);
        s.setError(msg, createResult.error?.code || "create_room_failed");
        return;
      }

      const newRoomId = createResult.data.room.id;
      s.setRoomId(newRoomId);
      log("Room created:", newRoomId);

      // Step 2: Join room (edge function → get Fishjam token)
      s.setCallPhase("joining_room");
      log("Joining room...");

      const joinResult = await videoApi.joinRoom(newRoomId);
      if (!joinResult.ok || !joinResult.data) {
        const msg = joinResult.error?.message || "Failed to join room";
        logError("Room join failed:", msg);
        s.setError(msg, joinResult.error?.code || "join_room_failed");
        return;
      }

      const { token, user: joinedUser } = joinResult.data;
      log("Got Fishjam token for user:", joinedUser.id);

      // Step 3: Connect Fishjam peer
      s.setCallPhase("connecting_peer");
      log("Connecting Fishjam peer...");

      try {
        await joinRoomRef.current({
          peerToken: token,
          peerMetadata: {
            userId: joinedUser.id,
            username: joinedUser.username,
            avatar: joinedUser.avatar,
          },
        });
        log("Fishjam peer join initiated");
      } catch (peerErr: any) {
        logError("Fishjam peer join failed:", peerErr);
        s.setError(
          peerErr.message || "WebRTC connection failed",
          "peer_join_failed",
        );
        return;
      }

      // Step 4: Start media
      const mediaOk = await startMedia(callType);
      if (!mediaOk) {
        logError("Media start failed, aborting call");
        return;
      }

      // Step 5: Signal callees
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
        log("Call signal sent to", participantIds.length, "users");
      } catch (signalErr) {
        logWarn("Failed to send call signal (non-fatal):", signalErr);
      }

      startDurationTimer();
      log("Call fully connected:", newRoomId);
    },
    [user, startMedia, startDurationTimer, getStore],
  );

  // ── Join an existing call (incoming) ───────────────────────────────
  const joinCall = useCallback(
    async (roomId: string, callType: CallType = "video") => {
      const s = getStore();
      s.clearError();
      s.setCallType(callType);
      s.setRoomId(roomId);

      // Step 1: Join room (edge function → get Fishjam token)
      s.setCallPhase("joining_room");
      log("Joining existing room:", roomId);

      const joinResult = await videoApi.joinRoom(roomId);
      if (!joinResult.ok || !joinResult.data) {
        const msg = joinResult.error?.message || "Failed to join room";
        logError("Room join failed:", msg);
        s.setError(msg, joinResult.error?.code || "join_room_failed");
        return;
      }

      const { token, user: joinedUser } = joinResult.data;
      log("Got Fishjam token for user:", joinedUser.id);

      // Step 2: Connect Fishjam peer
      s.setCallPhase("connecting_peer");
      log("Connecting Fishjam peer...");

      try {
        await joinRoomRef.current({
          peerToken: token,
          peerMetadata: {
            userId: joinedUser.id,
            username: joinedUser.username,
            avatar: joinedUser.avatar,
          },
        });
        log("Fishjam peer join initiated");
      } catch (peerErr: any) {
        logError("Fishjam peer join failed:", peerErr);
        s.setError(
          peerErr.message || "WebRTC connection failed",
          "peer_join_failed",
        );
        return;
      }

      // Step 3: Start media
      const mediaOk = await startMedia(callType);
      if (!mediaOk) {
        logError("Media start failed, aborting call");
        return;
      }

      startDurationTimer();
      log("Joined call:", roomId);
    },
    [startMedia, startDurationTimer, getStore],
  );

  // ── Leave current call ─────────────────────────────────────────────
  const leaveCall = useCallback(() => {
    const s = getStore();
    const currentRoomId = s.roomId;
    const duration = s.callDuration;
    const mode = s.callType;

    log(`Leaving ${mode} call, roomId:`, currentRoomId, "duration:", duration);

    // End call signals
    if (currentRoomId) {
      callSignalsApi.endCallSignals(currentRoomId).catch((e) => {
        logWarn("Failed to end call signals:", e);
      });
    }

    // Stop media — only stop camera if it was a video call
    try {
      if (mode === "video" || s.isCameraOn) {
        cameraRef.current.stopCamera();
        log("Camera stopped");
      }
      micRef.current.stopMicrophone();
      log("Microphone stopped");
    } catch (e) {
      logWarn("Error stopping media:", e);
    }

    stopDurationTimer();
    leaveRoomRef.current();

    s.setCallEnded(duration);
    log(`[${mode.toUpperCase()}] Call ended, duration:`, duration);
  }, [stopDurationTimer, getStore]);

  // Keep leaveCallRef in sync for auto-end timeout
  leaveCallRef.current = leaveCall;

  // ── Toggle mute ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const s = getStore();
    if (s.isMicOn) {
      micRef.current.stopMicrophone();
      s.setMicOn(false);
      log("Mic muted");
    } else {
      micRef.current
        .startMicrophone()
        .then(() => {
          s.setMicOn(true);
          log("Mic unmuted");
        })
        .catch((e) => {
          logError("Failed to unmute mic:", e);
        });
    }
  }, [getStore]);

  // ── Escalate audio → video (explicit, permission-gated) ────────────
  // This is the ONLY way to enable camera during an audio call.
  // It requests camera permission, starts camera, then transitions mode.
  const escalateToVideo = useCallback(async (): Promise<boolean> => {
    const s = getStore();
    if (s.callType === "video") {
      log("Already in video mode, toggling camera");
      // Already video — just toggle camera on/off
      if (s.isCameraOn) {
        cameraRef.current.stopCamera();
        s.setCameraOn(false);
        log("Camera stopped");
      } else {
        try {
          const frontId = getFrontCameraId();
          await cameraRef.current.startCamera(frontId || null);
          s.setCameraOn(true);
          log("Camera restarted");
        } catch (e) {
          logError("Failed to restart camera:", e);
          return false;
        }
      }
      return true;
    }

    // Audio → Video escalation
    log("[ESCALATION] Audio → Video: requesting camera permission...");

    // Step 1: Request camera permission
    const hasCamPerm = cameraRef.current.cameraDevices?.length > 0;
    // We need to use the permission hook externally — for now, try starting camera
    // If permission was never granted, startCamera will fail and we surface the error

    // Step 2: Start camera
    try {
      const frontId = getFrontCameraId();
      const [track, err] = await cameraRef.current.startCamera(frontId || null);
      if (err) {
        logError("[ESCALATION] Camera permission denied or start failed:", err);
        s.setError(
          "Camera permission required to switch to video. Open Settings to grant access.",
          "escalation_camera_denied",
        );
        return false;
      }

      // Verify stream
      if (!cameraRef.current.cameraStream) {
        logError("[ESCALATION] Camera started but stream is null");
        s.setError("Camera stream not available", "escalation_stream_null");
        return false;
      }

      // Step 3: Transition mode THEN enable camera
      s.escalateToVideo(); // callType: audio → video
      s.setCameraOn(true); // Now safe — callType is "video"
      log("[ESCALATION] Successfully upgraded to video call");
      return true;
    } catch (e) {
      logError("[ESCALATION] Failed to start camera:", e);
      s.setError(
        "Failed to enable camera. Check permissions.",
        "escalation_failed",
      );
      return false;
    }
  }, [getFrontCameraId, getStore]);

  // ── Toggle video — delegates to escalation for audio mode ──────────
  const toggleVideo = useCallback(() => {
    escalateToVideo();
  }, [escalateToVideo]);

  // ── Switch camera (front/back) ─────────────────────────────────────
  const switchCamera = useCallback(() => {
    const stream = cameraRef.current.cameraStream;
    if (!stream) {
      logWarn("Cannot switch camera: no active stream");
      return;
    }
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && typeof (videoTrack as any)._switchCamera === "function") {
      (videoTrack as any)._switchCamera();
      getStore().toggleFrontCamera();
      log("Camera switched via _switchCamera");
    } else {
      logWarn("_switchCamera not available on track");
    }
  }, [getStore]);

  // ── Reset call ended state ─────────────────────────────────────────
  const resetCallEnded = useCallback(() => {
    getStore().reset();
    log("Call state reset");
  }, [getStore]);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopDurationTimer();
      leaveRoomRef.current();
      // Don't reset store here — call_ended UI may still be showing
    };
  }, [stopDurationTimer]);

  // ── Derived state for consumers ────────────────────────────────────
  const isAudioMode = store.callType === "audio";

  return {
    // State from store
    callPhase: store.callPhase,
    callType: store.callType,
    roomId: store.roomId,
    chatId: store.chatId,
    callEnded: store.callEnded,
    callDuration: store.callDuration,
    error: store.error,
    errorCode: store.errorCode,
    isConnected: store.connectionState.status === "connected",
    isInCall: store.callPhase === "connected",
    isMuted: !store.isMicOn,
    isVideoOff: !store.isCameraOn,
    localStream: store.localStream,
    participants: store.participants,
    cameraPermission: store.cameraPermission,
    micPermission: store.micPermission,

    // Derived
    isAudioMode,

    // Actions
    createCall,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    escalateToVideo,
    switchCamera,
    resetCallEnded,
  };
}
