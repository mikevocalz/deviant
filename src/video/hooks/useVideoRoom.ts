/**
 * useVideoRoom Hook
 * Main hook for managing video room state with Fishjam
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  RENDER-STABILITY GUARDRAIL — READ BEFORE EDITING                  ║
 * ║                                                                    ║
 * ║  All room state lives in useVideoRoomStore (Zustand).              ║
 * ║  This hook orchestrates Fishjam SDK ↔ store sync.                  ║
 * ║                                                                    ║
 * ║  1. NO useCallback may list store state or prop callbacks in deps. ║
 * ║     Read them from store.getState() / refs instead.                ║
 * ║                                                                    ║
 * ║  2. NO useEffect may depend on store state or derived callbacks.   ║
 * ║     Use [] for one-time subscriptions; use primitive Fishjam       ║
 * ║     values (peerStatus, reconnectionStatus) only where needed.     ║
 * ║                                                                    ║
 * ║  3. Fishjam SDK refs (joinRoom, leaveRoom) are ref-wrapped        ║
 * ║     because their identity is NOT guaranteed stable across         ║
 * ║     reconnects.                                                    ║
 * ║                                                                    ║
 * ║  ORIGINAL BUG: connectionState effect → setState (new obj) →      ║
 * ║  handleRoomEvent recreated (dep on state.localUser) →             ║
 * ║  scheduleTokenRefresh recreated → join recreated → screen         ║
 * ║  re-renders → effects re-fire → infinite loop.                    ║
 * ║                                                                    ║
 * ║  FIX: Zustand store + getState() eliminates all dependency cycles. ║
 * ║  Store updates are granular — only subscribed slices re-render.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useEffect, useRef } from "react";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
  useScreenShare,
} from "@fishjam-cloud/react-native-client";
import { AppState, type AppStateStatus } from "react-native";
import { videoApi } from "../api";
import { useVideoRoomStore } from "../stores/video-room-store";
import type {
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

  // ── Store access ──────────────────────────────────────────────────
  // Subscribe to full state for return value; use getState() in callbacks.
  const store = useVideoRoomStore();
  const getStore = useVideoRoomStore.getState;

  // ── Internal refs (timers, subscriptions) ───────────────────────────
  const tokenExpiresAtRef = useRef<Date | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentJtiRef = useRef<string | null>(null);
  const unsubscribeEventsRef = useRef<(() => void) | null>(null);
  const unsubscribeMembersRef = useRef<(() => void) | null>(null);

  // ── Ref-wrapped external callbacks & SDK refs ───────────────────────
  // Prevents dependency cycles — callbacks read from refs, not deps.

  // Prevents: handleEject depending on onEjected prop
  const onEjectedRef = useRef(onEjected);
  onEjectedRef.current = onEjected;

  // Prevents: handleRoomEnded depending on onRoomEnded prop
  const onRoomEndedRef = useRef(onRoomEnded);
  onRoomEndedRef.current = onRoomEnded;

  // Prevents: join/kick/ban/endRoom depending on onError prop
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Prevents: callbacks depending on Fishjam SDK refs whose identity
  // may change across reconnects
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
  // Deps: only primitive Fishjam status values. Store bails out if unchanged.
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

    getStore().setConnectionStatus(newStatus);
  }, [peerStatus, reconnectionStatus, getStore]);

  // ── Stable callbacks (deps: [] only) ────────────────────────────────
  // All mutable values read from store.getState() or refs.

  const clearTokenTimer = useCallback(() => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  }, []);

  const handleEject = useCallback(
    (payload: EjectPayload) => {
      getStore().setEjected(payload);
      leaveRoomRef.current();
      clearTokenTimer();
      onEjectedRef.current?.(payload);
    },
    [clearTokenTimer, getStore],
  );

  const handleRoomEnded = useCallback(() => {
    getStore().setRoomEnded();
    leaveRoomRef.current();
    clearTokenTimer();
    onRoomEndedRef.current?.();
  }, [clearTokenTimer, getStore]);

  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      console.log("[useVideoRoom] Event received:", event.type, event.payload);

      switch (event.type) {
        case "eject":
          if (event.targetId === getStore().localUser?.id) {
            const payload = event.payload as unknown as EjectPayload;
            handleEject(payload);
          }
          break;
        case "room_ended":
          handleRoomEnded();
          break;
      }
    },
    [handleEject, handleRoomEnded, getStore],
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

          // Reconnect with new token — read localUser from store
          const { localUser } = getStore();
          leaveRoomRef.current();
          await joinRoomRef.current({
            peerToken: result.data!.token,
            peerMetadata: {
              userId: localUser?.id,
              username: localUser?.username,
              avatar: localUser?.avatar,
              role: localUser?.role,
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
    [roomId, clearTokenTimer, handleEject, getStore],
  );

  const join = useCallback(async () => {
    if (getStore().isEjected) {
      onErrorRef.current?.("You have been removed from this room");
      return false;
    }

    getStore().setConnectionStatus("connecting");

    try {
      const result = await videoApi.joinRoom(roomId);

      if (!result.ok) {
        getStore().setConnectionStatus("error", result.error?.message);
        onErrorRef.current?.(result.error?.message || "Failed to join room");
        return false;
      }

      const { room, token, peer, user, expiresAt } = result.data!;

      tokenExpiresAtRef.current = new Date(expiresAt);
      currentJtiRef.current = peer.id;

      // Update store with room + localUser
      const s = getStore();
      s.setRoom({
        id: room.id,
        title: room.title,
        isPublic: false,
        status: "open",
        maxParticipants: 10,
        fishjamRoomId: room.fishjamRoomId,
        createdBy: "",
        createdAt: "",
      });
      s.setLocalUser({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        role: peer.role as MemberRole,
        peerId: peer.id,
      });

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
      getStore().setConnectionStatus("error", "Connection failed");
      onErrorRef.current?.("Failed to connect to room");
      return false;
    }
  }, [roomId, scheduleTokenRefresh, handleRoomEvent, getStore]);

  const leave = useCallback(async () => {
    console.log("[useVideoRoom] Leaving room...");

    clearTokenTimer();
    unsubscribeEventsRef.current?.();
    unsubscribeMembersRef.current?.();
    leaveRoomRef.current();

    const s = getStore();
    s.setConnectionStatus("disconnected");
    s.setParticipants([]);
  }, [clearTokenTimer, getStore]);

  // ── Media toggles ──────────────────────────────────────────────────
  // Read current on/off from store.getState(); read SDK hooks from refs.
  // Zero deps on state → stable identity.

  const toggleCamera = useCallback(async () => {
    if (getStore().isCameraOn) {
      cameraRef.current.stopCamera();
    } else {
      await cameraRef.current.startCamera();
    }
    getStore().toggleCamera();
  }, [getStore]);

  const toggleMic = useCallback(async () => {
    if (getStore().isMicOn) {
      microphoneRef.current.stopMicrophone();
    } else {
      await microphoneRef.current.startMicrophone();
    }
    getStore().toggleMic();
  }, [getStore]);

  const switchCamera = useCallback(async () => {
    cameraRef.current.stopCamera();
    await cameraRef.current.startCamera();
    getStore().toggleFrontCamera();
  }, [getStore]);

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
  // REF: Fishjam SDK v0.25 PeerWithTracks exposes distinguished tracks:
  //   peer.cameraTrack, peer.microphoneTrack (Track | undefined)
  // REF: https://docs.fishjam.io/tutorials/react-native-quick-start
  useEffect(() => {
    // Use remotePeers (peers is deprecated in v0.25)
    const allPeers = peersHook.remotePeers || peersHook.peers || [];
    const participants: Participant[] = allPeers.map((peer: any) => {
      const metadata = (peer.metadata as Record<string, unknown>) || {};
      // Fishjam SDK v0.25: use distinguished tracks, fallback to legacy
      const videoTrack =
        peer.cameraTrack ??
        peer.tracks?.find((t: any) => t.metadata?.type === "camera") ??
        null;
      const audioTrack =
        peer.microphoneTrack ??
        peer.tracks?.find((t: any) => t.metadata?.type === "microphone") ??
        null;

      return {
        odId: peer.id,
        oderId: peer.id,
        userId: (metadata.userId as string) || peer.id,
        username: metadata.username as string | undefined,
        avatar: metadata.avatar as string | undefined,
        role: (metadata.role as MemberRole) || "participant",
        isLocal: false,
        isCameraOn: !!(videoTrack?.stream || videoTrack?.track),
        isMicOn: !!(audioTrack?.stream || audioTrack?.track),
        isScreenSharing: !!peer.screenShareVideoTrack,
        videoTrack,
        audioTrack,
      };
    });

    getStore().setParticipants(participants);
  }, [peersHook.remotePeers, peersHook.peers, getStore]);

  // ── App state listener ─────────────────────────────────────────────
  // One-time subscription. Reads connection status from store.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === "active" &&
        getStore().connectionState.status === "connected"
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
  }, [getStore]);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  // Only run full cleanup (leaveRoom, reset) if we have a roomId.
  // For non-server rooms (empty roomId), this hook is a no-op and must
  // NOT call leaveRoom — that would kill the shared Fishjam camera/mic.
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  useEffect(() => {
    return () => {
      if (!roomIdRef.current) return;
      clearTokenTimer();
      unsubscribeEventsRef.current?.();
      unsubscribeMembersRef.current?.();
      leaveRoomRef.current();
      getStore().reset();
    };
  }, [clearTokenTimer, getStore]);

  // ── Public API ─────────────────────────────────────────────────────
  // Spread store state so consumers get reactive updates via Zustand.
  return {
    room: store.room,
    localUser: store.localUser,
    participants: store.participants,
    connectionState: store.connectionState,
    isCameraOn: store.isCameraOn,
    isMicOn: store.isMicOn,
    isFrontCamera: store.isFrontCamera,
    isEjected: store.isEjected,
    ejectReason: store.ejectReason,
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
