/**
 * useVideoRoom Hook
 * Main hook for managing video room state with Fishjam
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
  useScreenShare,
} from "@fishjam-cloud/react-native-client";
import { AppState, type AppStateStatus } from "react-native";
import { videoApi } from "../api";
import type {
  VideoRoomState,
  ConnectionState,
  Participant,
  EjectPayload,
  MemberRole,
  RoomEvent,
} from "../types";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

interface UseVideoRoomOptions {
  roomId: string;
  onEjected?: (reason: EjectPayload) => void;
  onRoomEnded?: () => void;
  onError?: (error: string) => void;
}

export function useVideoRoom({
  roomId,
  onEjected,
  onRoomEnded,
  onError,
}: UseVideoRoomOptions) {
  const { joinRoom, leaveRoom, peerStatus, reconnectionStatus } =
    useConnection();
  const cameraHook = useCamera();
  const microphoneHook = useMicrophone();
  const screenShareHook = useScreenShare();
  const peersHook = usePeers();

  const [state, setState] = useState<VideoRoomState>({
    room: null,
    localUser: null,
    participants: [],
    connectionState: { status: "disconnected" },
    isCameraOn: false,
    isMicOn: false,
    isFrontCamera: true,
    isEjected: false,
  });

  const tokenExpiresAtRef = useRef<Date | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentJtiRef = useRef<string | null>(null);
  const unsubscribeEventsRef = useRef<(() => void) | null>(null);
  const unsubscribeMembersRef = useRef<(() => void) | null>(null);

  // Update connection state based on Fishjam status
  useEffect(() => {
    let newStatus: ConnectionState["status"] = "disconnected";

    if (peerStatus === "connected") {
      newStatus = "connected";
    } else if (peerStatus === "connecting") {
      newStatus = "connecting";
    } else if (reconnectionStatus === "reconnecting") {
      newStatus = "reconnecting";
    } else if (peerStatus === "error") {
      newStatus = "error";
    }

    setState((prev) => ({
      ...prev,
      connectionState: { status: newStatus },
    }));
  }, [peerStatus, reconnectionStatus]);

  // Handle eject event
  const handleEject = useCallback(
    (payload: EjectPayload) => {
      setState((prev) => ({
        ...prev,
        isEjected: true,
        ejectReason: payload,
        connectionState: { status: "disconnected" },
      }));

      leaveRoom();

      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }

      onEjected?.(payload);
    },
    [leaveRoom, onEjected],
  );

  // Handle room ended event
  const handleRoomEnded = useCallback(() => {
    setState((prev) => ({
      ...prev,
      room: prev.room ? { ...prev.room, status: "ended" } : null,
      connectionState: { status: "disconnected" },
    }));

    leaveRoom();

    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }

    onRoomEnded?.();
  }, [leaveRoom, onRoomEnded]);

  // Handle room events
  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      console.log("[useVideoRoom] Event received:", event.type, event.payload);

      switch (event.type) {
        case "eject":
          if (event.targetId === state.localUser?.id) {
            const payload = event.payload as unknown as EjectPayload;
            handleEject(payload);
          }
          break;
        case "room_ended":
          handleRoomEnded();
          break;
      }
    },
    [state.localUser?.id, handleEject, handleRoomEnded],
  );

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(
    (expiresAt: Date) => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }

      const now = Date.now();
      const refreshAt = expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS;
      const delay = Math.max(0, refreshAt - now);

      console.log(`[useVideoRoom] Token refresh scheduled in ${delay / 1000}s`);

      tokenRefreshTimerRef.current = setTimeout(async () => {
        try {
          console.log("[useVideoRoom] Refreshing token...");
          const result = await videoApi.refreshToken(
            roomId,
            currentJtiRef.current || undefined,
          );

          if (!result.ok) {
            console.error("[useVideoRoom] Token refresh failed:", result.error);
            if (result.error?.code === "forbidden") {
              handleEject({ action: "kick", reason: "Session expired" });
            }
            return;
          }

          // Reconnect with new token
          leaveRoom();
          await joinRoom({
            peerToken: result.data!.token,
            peerMetadata: {
              userId: state.localUser?.id,
              username: state.localUser?.username,
              avatar: state.localUser?.avatar,
              role: state.localUser?.role,
            },
          });

          tokenExpiresAtRef.current = new Date(result.data!.expiresAt);
          scheduleTokenRefresh(tokenExpiresAtRef.current);
        } catch (err) {
          console.error("[useVideoRoom] Token refresh error:", err);
          onError?.("Failed to refresh session");
        }
      }, delay);
    },
    [roomId, joinRoom, leaveRoom, handleEject, onError, state.localUser],
  );

  // Join room
  const join = useCallback(async () => {
    if (state.isEjected) {
      onError?.("You have been removed from this room");
      return false;
    }

    setState((prev) => ({
      ...prev,
      connectionState: { status: "connecting" },
    }));

    try {
      const result = await videoApi.joinRoom(roomId);

      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          connectionState: { status: "error", error: result.error?.message },
        }));
        onError?.(result.error?.message || "Failed to join room");
        return false;
      }

      const { room, token, peer, user, expiresAt } = result.data!;

      tokenExpiresAtRef.current = new Date(expiresAt);
      currentJtiRef.current = peer.id;

      setState((prev) => ({
        ...prev,
        room: {
          id: room.id,
          title: room.title,
          isPublic: false,
          status: "open",
          maxParticipants: 10,
          fishjamRoomId: room.fishjamRoomId,
          createdBy: "",
          createdAt: "",
        },
        localUser: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          role: peer.role as MemberRole,
          peerId: peer.id,
        },
      }));

      // Connect to Fishjam
      await joinRoom({
        peerToken: token,
        peerMetadata: {
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          role: peer.role,
        },
      });

      // Schedule token refresh
      scheduleTokenRefresh(tokenExpiresAtRef.current);

      // Subscribe to room events
      unsubscribeEventsRef.current = videoApi.subscribeToRoomEvents(
        roomId,
        user.id,
        handleRoomEvent,
      );

      // Subscribe to member changes
      unsubscribeMembersRef.current = videoApi.subscribeToMembers(
        roomId,
        (member, eventType) => {
          console.log(
            "[useVideoRoom] Member change:",
            eventType,
            member.userId,
          );
        },
      );

      return true;
    } catch (err) {
      console.error("[useVideoRoom] Join error:", err);
      setState((prev) => ({
        ...prev,
        connectionState: { status: "error", error: "Connection failed" },
      }));
      onError?.("Failed to connect to room");
      return false;
    }
  }, [
    roomId,
    state.isEjected,
    joinRoom,
    scheduleTokenRefresh,
    handleRoomEvent,
    onError,
  ]);

  // Leave room
  const leave = useCallback(async () => {
    console.log("[useVideoRoom] Leaving room...");

    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }

    unsubscribeEventsRef.current?.();
    unsubscribeMembersRef.current?.();

    leaveRoom();

    setState((prev) => ({
      ...prev,
      connectionState: { status: "disconnected" },
      participants: [],
    }));
  }, [leaveRoom]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (state.isCameraOn) {
      cameraHook.stopCamera();
    } else {
      await cameraHook.startCamera();
    }
    setState((prev) => ({ ...prev, isCameraOn: !prev.isCameraOn }));
  }, [cameraHook, state.isCameraOn]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (state.isMicOn) {
      microphoneHook.stopMicrophone();
    } else {
      await microphoneHook.startMicrophone();
    }
    setState((prev) => ({ ...prev, isMicOn: !prev.isMicOn }));
  }, [microphoneHook, state.isMicOn]);

  // Switch camera - simple toggle for front/back
  const switchCamera = useCallback(async () => {
    // Stop current camera and restart with different facing mode
    cameraHook.stopCamera();
    // The Fishjam SDK handles camera switching internally
    await cameraHook.startCamera();
    setState((prev) => ({ ...prev, isFrontCamera: !prev.isFrontCamera }));
  }, [cameraHook]);

  // Kick user (host/mod only)
  const kickUser = useCallback(
    async (targetUserId: string, reason?: string) => {
      const result = await videoApi.kickUser({ roomId, targetUserId, reason });
      if (!result.ok) {
        onError?.(result.error?.message || "Failed to kick user");
      }
      return result.ok;
    },
    [roomId, onError],
  );

  // Ban user (host/mod only)
  const banUser = useCallback(
    async (targetUserId: string, reason?: string, durationMinutes?: number) => {
      const result = await videoApi.banUser({
        roomId,
        targetUserId,
        reason,
        durationMinutes,
      });
      if (!result.ok) {
        onError?.(result.error?.message || "Failed to ban user");
      }
      return result.ok;
    },
    [roomId, onError],
  );

  // End room (host only)
  const endRoom = useCallback(async () => {
    const result = await videoApi.endRoom(roomId);
    if (!result.ok) {
      onError?.(result.error?.message || "Failed to end room");
    }
    return result.ok;
  }, [roomId, onError]);

  // Build participants list from Fishjam peers
  useEffect(() => {
    const allPeers = peersHook.peers || [];
    const participants: Participant[] = allPeers.map((peer) => {
      const metadata = (peer.metadata as Record<string, unknown>) || {};
      const tracks = peer.tracks || [];

      return {
        odId: peer.id,
        oderId: peer.id,
        userId: (metadata.userId as string) || peer.id,
        username: metadata.username as string | undefined,
        avatar: metadata.avatar as string | undefined,
        role: (metadata.role as MemberRole) || "participant",
        isLocal: false,
        isCameraOn: tracks.some(
          (t) => t.metadata?.type === "camera" && t.stream,
        ),
        isMicOn: tracks.some(
          (t) => t.metadata?.type === "microphone" && t.stream,
        ),
        isScreenSharing: tracks.some(
          (t) => t.metadata?.type === "screenShareVideo",
        ),
        videoTrack: tracks.find((t) => t.metadata?.type === "camera"),
        audioTrack: tracks.find((t) => t.metadata?.type === "microphone"),
      };
    });

    setState((prev) => ({ ...prev, participants }));
  }, [peersHook.peers]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === "active" &&
        state.connectionState.status === "connected"
      ) {
        console.log("[useVideoRoom] App became active, checking connection...");
      } else if (nextAppState === "background") {
        console.log("[useVideoRoom] App went to background");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [state.connectionState.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
      unsubscribeEventsRef.current?.();
      unsubscribeMembersRef.current?.();
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    ...state,
    join,
    leave,
    toggleCamera,
    toggleMic,
    switchCamera,
    kickUser,
    banUser,
    endRoom,
    camera: cameraHook,
    microphone: microphoneHook,
    screenShare: screenShareHook,
  };
}
