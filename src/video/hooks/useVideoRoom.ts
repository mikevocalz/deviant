/**
 * useVideoRoom Hook
 * Main hook for managing video room state with Fishjam
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  RENDER-STABILITY GUARDRAIL — READ BEFORE EDITING                  ║
 * ║                                                                    ║
 * ║  This hook uses a ref-based architecture to prevent infinite       ║
 * ║  re-render loops. The rules below are MANDATORY:                   ║
 * ║                                                                    ║
 * ║  1. NO useCallback may list `state`, `state.*`, or any prop       ║
 * ║     callback (onError, onEjected, onRoomEnded) in its deps.       ║
 * ║     Read them from stateRef.current / onErrorRef.current instead.  ║
 * ║                                                                    ║
 * ║  2. NO useEffect may depend on state or any derived callback.     ║
 * ║     Use [] for one-time subscriptions; use primitive Fishjam      ║
 * ║     values (peerStatus, reconnectionStatus) only where needed.     ║
 * ║                                                                    ║
 * ║  3. setState must bail out (return prev) when nothing changed.    ║
 * ║                                                                    ║
 * ║  4. Fishjam SDK refs (joinRoom, leaveRoom) are ref-wrapped        ║
 * ║     because their identity is NOT guaranteed stable across         ║
 * ║     reconnects.                                                    ║
 * ║                                                                    ║
 * ║  ORIGINAL BUG: connectionState effect → setState (new obj) →      ║
 * ║  handleRoomEvent recreated (dep on state.localUser) →             ║
 * ║  scheduleTokenRefresh recreated → join recreated → screen         ║
 * ║  re-renders → effects re-fire → infinite loop.                    ║
 * ║                                                                    ║
 * ║  If you add a new callback, it MUST follow these rules.           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
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

  // ── Canonical state ─────────────────────────────────────────────────
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

  // ── Internal refs (timers, subscriptions) ───────────────────────────
  const tokenExpiresAtRef = useRef<Date | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentJtiRef = useRef<string | null>(null);
  const unsubscribeEventsRef = useRef<(() => void) | null>(null);
  const unsubscribeMembersRef = useRef<(() => void) | null>(null);

  // ── Ref-wrapped values to break dependency cycles ───────────────────
  // WHY: Callbacks that read state would need `state` in their deps,
  // causing them to recreate on every render, which cascades into
  // infinite re-render loops. Reading from refs is render-stable.

  // Prevents: callbacks depending on state → recreating → re-triggering effects
  const stateRef = useRef(state);
  stateRef.current = state;

  // Prevents: handleEject depending on onEjected prop → recreating when parent re-renders
  const onEjectedRef = useRef(onEjected);
  onEjectedRef.current = onEjected;

  // Prevents: handleRoomEnded depending on onRoomEnded prop
  const onRoomEndedRef = useRef(onRoomEnded);
  onRoomEndedRef.current = onRoomEnded;

  // Prevents: join/kick/ban/endRoom depending on onError prop
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Prevents: scheduleTokenRefresh/join/leave depending on Fishjam SDK refs
  // whose identity may change across reconnects
  const joinRoomRef = useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  // Prevents: toggleCamera/toggleMic depending on cameraHook/microphoneHook
  const cameraRef = useRef(cameraHook);
  cameraRef.current = cameraHook;
  const microphoneRef = useRef(microphoneHook);
  microphoneRef.current = microphoneHook;

  // ── Connection state sync ───────────────────────────────────────────
  // Deps: only primitive Fishjam status values. Bails out if unchanged.
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

    setState((prev) => {
      if (prev.connectionState.status === newStatus) return prev;
      return { ...prev, connectionState: { status: newStatus } };
    });
  }, [peerStatus, reconnectionStatus]);

  // ── Stable callbacks (deps: [] only) ────────────────────────────────
  // All mutable values read from refs. Identity never changes.

  const clearTokenTimer = useCallback(() => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  }, []);

  const handleEject = useCallback(
    (payload: EjectPayload) => {
      setState((prev) => {
        if (prev.isEjected) return prev; // already ejected, bail
        return {
          ...prev,
          isEjected: true,
          ejectReason: payload,
          connectionState: { status: "disconnected" },
        };
      });

      leaveRoomRef.current();
      clearTokenTimer();
      onEjectedRef.current?.(payload);
    },
    [clearTokenTimer], // clearTokenTimer is stable (deps: [])
  );

  const handleRoomEnded = useCallback(() => {
    setState((prev) => ({
      ...prev,
      room: prev.room ? { ...prev.room, status: "ended" } : null,
      connectionState: { status: "disconnected" },
    }));

    leaveRoomRef.current();
    clearTokenTimer();
    onRoomEndedRef.current?.();
  }, [clearTokenTimer]);

  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      console.log("[useVideoRoom] Event received:", event.type, event.payload);

      switch (event.type) {
        case "eject":
          if (event.targetId === stateRef.current.localUser?.id) {
            const payload = event.payload as unknown as EjectPayload;
            handleEject(payload);
          }
          break;
        case "room_ended":
          handleRoomEnded();
          break;
      }
    },
    [handleEject, handleRoomEnded], // both stable (deps: [clearTokenTimer] which is [])
  );

  const scheduleTokenRefresh = useCallback(
    (expiresAt: Date) => {
      clearTokenTimer();

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

          // Reconnect with new token — read localUser from ref
          leaveRoomRef.current();
          await joinRoomRef.current({
            peerToken: result.data!.token,
            peerMetadata: {
              userId: stateRef.current.localUser?.id,
              username: stateRef.current.localUser?.username,
              avatar: stateRef.current.localUser?.avatar,
              role: stateRef.current.localUser?.role,
            },
          });

          tokenExpiresAtRef.current = new Date(result.data!.expiresAt);
          scheduleTokenRefresh(tokenExpiresAtRef.current);
        } catch (err) {
          console.error("[useVideoRoom] Token refresh error:", err);
          onErrorRef.current?.("Failed to refresh session");
        }
      }, delay);
    },
    [roomId, clearTokenTimer, handleEject], // all stable
  );

  const join = useCallback(async () => {
    if (stateRef.current.isEjected) {
      onErrorRef.current?.("You have been removed from this room");
      return false;
    }

    setState((prev) => {
      if (prev.connectionState.status === "connecting") return prev;
      return { ...prev, connectionState: { status: "connecting" } };
    });

    try {
      const result = await videoApi.joinRoom(roomId);

      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          connectionState: { status: "error", error: result.error?.message },
        }));
        onErrorRef.current?.(result.error?.message || "Failed to join room");
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

      // Connect to Fishjam — use ref for stable identity
      await joinRoomRef.current({
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
      onErrorRef.current?.("Failed to connect to room");
      return false;
    }
  }, [roomId, scheduleTokenRefresh, handleRoomEvent]); // all stable

  const leave = useCallback(async () => {
    console.log("[useVideoRoom] Leaving room...");

    clearTokenTimer();
    unsubscribeEventsRef.current?.();
    unsubscribeMembersRef.current?.();
    leaveRoomRef.current();

    setState((prev) => {
      if (
        prev.connectionState.status === "disconnected" &&
        prev.participants.length === 0
      ) {
        return prev;
      }
      return {
        ...prev,
        connectionState: { status: "disconnected" },
        participants: [],
      };
    });
  }, [clearTokenTimer]); // stable

  // ── Media toggles ──────────────────────────────────────────────────
  // Read current on/off from stateRef; read SDK hooks from refs.
  // Zero deps on state → stable identity.

  const toggleCamera = useCallback(async () => {
    if (stateRef.current.isCameraOn) {
      cameraRef.current.stopCamera();
    } else {
      await cameraRef.current.startCamera();
    }
    setState((prev) => ({ ...prev, isCameraOn: !prev.isCameraOn }));
  }, []);

  const toggleMic = useCallback(async () => {
    if (stateRef.current.isMicOn) {
      microphoneRef.current.stopMicrophone();
    } else {
      await microphoneRef.current.startMicrophone();
    }
    setState((prev) => ({ ...prev, isMicOn: !prev.isMicOn }));
  }, []);

  const switchCamera = useCallback(async () => {
    cameraRef.current.stopCamera();
    await cameraRef.current.startCamera();
    setState((prev) => ({ ...prev, isFrontCamera: !prev.isFrontCamera }));
  }, []);

  // ── Admin actions ──────────────────────────────────────────────────
  // Only depend on roomId (static for hook lifetime).

  const kickUser = useCallback(
    async (targetUserId: string, reason?: string) => {
      const result = await videoApi.kickUser({ roomId, targetUserId, reason });
      if (!result.ok) {
        onErrorRef.current?.(result.error?.message || "Failed to kick user");
      }
      return result.ok;
    },
    [roomId],
  );

  const banUser = useCallback(
    async (targetUserId: string, reason?: string, durationMinutes?: number) => {
      const result = await videoApi.banUser({
        roomId,
        targetUserId,
        reason,
        durationMinutes,
      });
      if (!result.ok) {
        onErrorRef.current?.(result.error?.message || "Failed to ban user");
      }
      return result.ok;
    },
    [roomId],
  );

  const endRoom = useCallback(async () => {
    const result = await videoApi.endRoom(roomId);
    if (!result.ok) {
      onErrorRef.current?.(result.error?.message || "Failed to end room");
    }
    return result.ok;
  }, [roomId]);

  // ── Participants sync ──────────────────────────────────────────────
  // Only fires when Fishjam peer list changes (referential identity from SDK).
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

    setState((prev) => {
      // Bail out if peer count hasn't changed and IDs match
      if (
        prev.participants.length === participants.length &&
        prev.participants.every((p, i) => p.userId === participants[i]?.userId)
      ) {
        // Still update tracks/camera state even if same users
        const tracksChanged = prev.participants.some(
          (p, i) =>
            p.isCameraOn !== participants[i]?.isCameraOn ||
            p.isMicOn !== participants[i]?.isMicOn,
        );
        if (!tracksChanged) return prev;
      }
      return { ...prev, participants };
    });
  }, [peersHook.peers]);

  // ── App state listener ─────────────────────────────────────────────
  // One-time subscription. Reads connection status from stateRef.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === "active" &&
        stateRef.current.connectionState.status === "connected"
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
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTokenTimer();
      unsubscribeEventsRef.current?.();
      unsubscribeMembersRef.current?.();
      leaveRoomRef.current();
    };
  }, [clearTokenTimer]);

  // ── Public API ─────────────────────────────────────────────────────
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
