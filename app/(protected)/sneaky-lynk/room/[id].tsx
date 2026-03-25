/**
 * Sneaky Lynk Room Screen
 * Live audio/video room with speakers, listeners, and controls
 * Uses Fishjam for real audio/video — no mock data
 *
 * ARCHITECTURE: Two separate components to avoid useVideoRoom's internal
 * useCamera() from interfering with the shared Fishjam camera context.
 * - LocalRoom: uses useCamera/useMicrophone directly (no useVideoRoom)
 * - ServerRoom: uses useVideoRoom for full Fishjam room management
 */

import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary as GlobalErrorBoundary } from "@/components/error-boundary";
import {
  ArrowLeft,
  ChevronUp,
  Users,
  EyeOff,
  Radio,
  Mic,
  MicOff,
} from "lucide-react-native";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  useCameraPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";
import { useCamera, useMicrophone } from "@fishjam-cloud/react-native-client";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import { useAuthStore } from "@/lib/stores/auth-store";
import { supabase } from "@/lib/supabase/client";
import {
  VideoStage,
  VideoGrid,
  ParticipantActions,
  SpeakerGrid,
  ListenerGrid,
  ControlsBar,
  ConnectionBanner,
  EjectModal,
  ChatSheet,
  RoomTimer,
  RoomParticipantsSheet,
} from "@/src/sneaky-lynk/ui";
import type { VideoParticipant } from "@/src/sneaky-lynk/ui";
import type { SneakyRoom, SneakyUser } from "@/src/sneaky-lynk/types";
import { videoApi } from "@/src/video/api";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRoomStore } from "@/src/sneaky-lynk/stores/room-store";
import { useLynkHistoryStore } from "@/src/sneaky-lynk/stores/lynk-history-store";
import { sneakyLynkApi } from "@/src/sneaky-lynk/api/supabase";
import { audioSession } from "@/src/services/calls/audioSession";
import { shareUrl } from "@/lib/deep-linking/share-link";
import {
  DVNTLiquidGlass,
  DVNTLiquidGlassIconButton,
} from "@/components/media/DVNTLiquidGlass";
import { useRoomReactions } from "@/src/sneaky-lynk/hooks/useRoomReactions";

// ── Error Boundary (per-route) — surfaces real crash message ────────

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#EF4444",
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 12,
        }}
      >
        Room Error
      </Text>
      <Text
        style={{
          color: "#9CA3AF",
          fontSize: 13,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {error.message}
      </Text>
      <ScrollView style={{ maxHeight: 200, width: "100%", marginBottom: 16 }}>
        <Text
          style={{ color: "#6B7280", fontSize: 10, fontFamily: "monospace" }}
        >
          {error.stack}
        </Text>
      </ScrollView>
      <Pressable
        onPress={retry}
        style={{
          backgroundColor: "#FC253A",
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────

function normalizeAnonLabel(label?: string | null): string | null {
  if (!label) return null;
  const match = label.match(/anon(?:\s+lynk)?\s+(\d+)/i);
  if (match) return `Anon ${match[1]}`;
  return label;
}

function buildLocalUser(authUser: any): SneakyUser {
  return {
    id: authUser?.id || "local",
    username: authUser?.username || "You",
    displayName: authUser?.username || authUser?.name || "You",
    avatar: authUser?.avatar || "",
    isVerified: authUser?.isVerified || false,
  };
}

function isClosedRoomError(message?: string | null) {
  if (!message) return false;
  return /no longer open|already ended|has ended|room not found|not found/i.test(
    message,
  );
}

type PresenceTone = "join" | "leave";

interface PresenceEvent {
  id: string;
  label: string;
  tone: PresenceTone;
}

function buildLynkShareUrl(roomId: string) {
  return `https://dvntlive.app/sneaky-lynk/room/${roomId}`;
}

function PresenceToast({ event }: { event: PresenceEvent }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 88,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 40,
      }}
    >
      <DVNTLiquidGlass
        radius={999}
        paddingH={14}
        paddingV={10}
        style={{
          borderWidth: 1,
          borderColor:
            event.tone === "join"
              ? "rgba(45, 212, 191, 0.28)"
              : "rgba(248, 113, 113, 0.24)",
          backgroundColor:
            event.tone === "join"
              ? "rgba(13, 24, 28, 0.24)"
              : "rgba(24, 10, 12, 0.24)",
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: event.tone === "join" ? "#2DD4BF" : "#FB7185",
          }}
        />
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {event.label}
        </Text>
      </DVNTLiquidGlass>
    </View>
  );
}

function ClosedRoomScreen({
  roomTitle,
  message,
  onBack,
}: {
  roomTitle: string;
  message: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={onBack} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text
            className="text-foreground font-semibold text-center"
            numberOfLines={1}
          >
            {roomTitle || "Sneaky Lynk"}
          </Text>
        </View>
        <View className="w-6" />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center mb-6">
          <Radio size={36} color="#6B7280" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center mb-3">
          Lynk Closed
        </Text>
        <Text className="text-muted-foreground text-center mb-8">
          {message}
        </Text>
        <Pressable
          onPress={onBack}
          className="px-6 py-4 rounded-full bg-secondary items-center"
        >
          <Text className="text-foreground font-semibold">Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Pre-Join Screen ──────────────────────────────────────────────────

function PreJoinScreen({
  roomTitle,
  onJoin,
  onBack,
}: {
  roomTitle: string;
  onJoin: (anonymous: boolean) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [anonymous, setAnonymous] = React.useState(false);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={onBack} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text
            className="text-foreground font-semibold text-center"
            numberOfLines={1}
          >
            {roomTitle || "Join Lynk"}
          </Text>
        </View>
        <View className="w-6" />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6">
          <Radio size={40} color="#FC253A" />
        </View>

        <Text className="text-2xl font-bold text-foreground text-center mb-2">
          {roomTitle || "Sneaky Lynk"}
        </Text>
        <Text className="text-muted-foreground text-center mb-10">
          Choose how you want to appear in this room
        </Text>

        {/* Anonymous Toggle */}
        <View className="w-full bg-secondary rounded-2xl px-5 py-4 mb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                <EyeOff size={20} color="#FC253A" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  Join Anonymously
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  You&apos;ll appear as &quot;Anon 1&quot; with no profile info
                </Text>
              </View>
            </View>
            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: "#374151", true: "#FC253A" }}
              thumbColor="#fff"
            />
          </View>

          {anonymous && (
            <View className="mt-3 pt-3 border-t border-border/50">
              <Text className="text-xs text-muted-foreground">
                Your identity will be hidden from other participants. The host
                and moderators cannot see who you are.
              </Text>
            </View>
          )}
        </View>

        {/* Join Button */}
        <Pressable
          onPress={() => onJoin(anonymous)}
          className="w-full py-4 rounded-full bg-primary items-center active:bg-primary/80"
        >
          <Text className="text-white font-bold text-base">
            {anonymous ? "Join Anonymously" : "Join Lynk"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Router entry point ──────────────────────────────────────────────

function SneakyLynkRoomScreenContent() {
  const {
    id,
    title: paramTitle,
    hasVideo: hasVideoParam,
    isHost: isHostParam,
  } = useLocalSearchParams<{
    id: string;
    title?: string;
    hasVideo?: string;
    isHost?: string;
  }>();
  const router = useRouter();

  const roomHasVideo = hasVideoParam === "1";
  const isServerRoom = !id?.startsWith("space-") && id !== "my-room";

  // Host (creator) skips the pre-join screen entirely
  const isCreator = isHostParam === "1";
  const shouldGateJoin = isServerRoom && !isCreator;
  // Pre-join state for server rooms (joiners, not creators)
  const [hasJoined, setHasJoined] = useState(!isServerRoom || isCreator);
  const [joinAnonymous, setJoinAnonymous] = useState(false);
  const [roomLookup, setRoomLookup] = useState<{
    loading: boolean;
    room: SneakyRoom | null;
  }>({
    loading: shouldGateJoin,
    room: null,
  });

  useEffect(() => {
    if (!shouldGateJoin || !id) return;

    let cancelled = false;
    setRoomLookup({ loading: true, room: null });

    (async () => {
      const room = await sneakyLynkApi.getRoomById(id);
      if (!cancelled) {
        setRoomLookup({ loading: false, room });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, shouldGateJoin]);

  const handleJoin = useCallback((anonymous: boolean) => {
    setJoinAnonymous(anonymous);
    setHasJoined(true);
  }, []);

  if (shouldGateJoin && roomLookup.loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-muted-foreground mt-4">Loading Lynk...</Text>
      </View>
    );
  }

  if (
    shouldGateJoin &&
    (!roomLookup.room ||
      roomLookup.room.status === "ended" ||
      !roomLookup.room.isLive)
  ) {
    return (
      <ClosedRoomScreen
        roomTitle={roomLookup.room?.title || paramTitle || "Sneaky Lynk"}
        message={
          roomLookup.room
            ? "This Lynk has ended and can't be reopened."
            : "This Lynk is unavailable."
        }
        onBack={() => router.back()}
      />
    );
  }

  // Show pre-join screen for server rooms
  if (isServerRoom && !hasJoined) {
    return (
      <PreJoinScreen
        roomTitle={roomLookup.room?.title || paramTitle || "Sneaky Lynk"}
        onJoin={handleJoin}
        onBack={() => router.back()}
      />
    );
  }

  if (isServerRoom) {
    return (
      <ServerRoom
        id={id}
        paramTitle={paramTitle}
        roomHasVideo={roomHasVideo}
        anonymous={joinAnonymous}
        initialRoom={roomLookup.room}
      />
    );
  }
  return (
    <LocalRoom id={id} paramTitle={paramTitle} roomHasVideo={roomHasVideo} />
  );
}

// ── LocalRoom: direct Fishjam camera/mic, NO useVideoRoom ──────────

function LocalRoom({
  id,
  paramTitle,
  roomHasVideo = true,
}: {
  id: string;
  paramTitle?: string;
  roomHasVideo?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const fishjamCamera = useCamera();
  const fishjamMic = useMicrophone();
  const endRoom = useLynkHistoryStore((s) => s.endRoom);

  // VisionCamera permissions for native camera preview
  const {
    hasPermission: hasCamPermission,
    requestPermission: requestCamPermission,
  } = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  // Keep refs to the latest camera/mic so effects never use stale closures.
  const cameraRef = useRef(fishjamCamera);
  const micRef = useRef(fishjamMic);
  useEffect(() => {
    cameraRef.current = fishjamCamera;
  }, [fishjamCamera]);
  useEffect(() => {
    micRef.current = fishjamMic;
  }, [fishjamMic]);

  const {
    isHandRaised,
    activeSpeakerId,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    connectionState: storeConnectionState,
    coHost: storeCoHost,
    listeners: storeListeners,
    toggleHand,
    setActiveSpeakerId,
    openChat,
    closeChat,
    hideEject,
    reset,
  } = useRoomStore();

  // Local video on/off state (CameraView doesn't have isCameraOn)
  const [localVideoOn, setLocalVideoOn] = React.useState(roomHasVideo);

  const localUser = buildLocalUser(authUser);
  const effectiveMuted = !fishjamMic.isMicrophoneOn;
  const effectiveVideoOn = localVideoOn && hasCamPermission;

  // Reset store on mount, request permissions
  useEffect(() => {
    reset();
    requestCamPermission();
    requestMicPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start audio session + mic on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Configure audio session BEFORE starting mic (no CallKit for Lynk rooms)
        // Lynks are social rooms, not private calls. Always route audio to speaker.
        audioSession.startForLynk(true);
        console.log("[SneakyLynk:Local] Starting mic");
        await micRef.current.startMicrophone();
        if (!cancelled) console.log("[SneakyLynk:Local] Mic started");
      } catch (e) {
        console.warn("[SneakyLynk:Local] Failed to start mic:", e);
      }
    })();
    return () => {
      cancelled = true;
      micRef.current.stopMicrophone();
      audioSession.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speaking indicator
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
    } else {
      setActiveSpeakerId(localUser.id);
    }
  }, [effectiveMuted, localUser.id, setActiveSpeakerId]);

  const roomTitle = paramTitle || "Sneaky Lynk";

  const handleLeave = useCallback(async () => {
    // Local rooms are always hosted by the creator — end in DB too
    const result = await sneakyLynkApi.endRoom(id);
    if (!result.ok && !isClosedRoomError(result.error?.message)) {
      console.error(
        "[SneakyLynk:Local] Failed to end room in DB:",
        result.error?.message,
      );
      showToast(
        "error",
        "Couldn't close Lynk",
        result.error?.message || "Try again. The Lynk is still open.",
      );
      return;
    }

    if (result.ok) {
      console.log("[SneakyLynk:Local] Room ended in DB:", id);
    } else {
      console.warn(
        "[SneakyLynk:Local] Room already closed or unavailable:",
        result.error?.message,
      );
    }

    endRoom(id, storeListeners.length);
    router.back();
  }, [router, id, endRoom, storeListeners.length, showToast]);
  const handleShare = useCallback(async () => {
    await shareUrl(buildLynkShareUrl(id), {
      title: roomTitle,
      message: `Join "${roomTitle}" on DVNT\n${buildLynkShareUrl(id)}`,
    });
  }, [id, roomTitle]);
  const handleToggleMic = useCallback(async () => {
    if (micRef.current.isMicrophoneOn) micRef.current.stopMicrophone();
    else await micRef.current.startMicrophone();
  }, []);
  const handleToggleVideo = useCallback(() => {
    setLocalVideoOn((prev) => !prev);
  }, []);
  const handleToggleHand = useCallback(() => toggleHand(), [toggleHand]);
  const handleChat = useCallback(() => openChat(), [openChat]);
  const handleCloseChat = useCallback(() => closeChat(), [closeChat]);
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  // Build flat VideoParticipant[] for VideoGrid
  const allParticipants: VideoParticipant[] = [];

  // Local user (host)
  allParticipants.push({
    id: localUser.id,
    user: localUser,
    role: "host",
    isLocal: true,
    isCameraOn: effectiveVideoOn,
    isMicOn: !effectiveMuted,
    videoTrack: undefined, // local room uses native camera preview
  });

  // Co-host
  if (storeCoHost) {
    allParticipants.push({
      id: storeCoHost.user.id,
      user: storeCoHost.user,
      role: "co-host",
      isLocal: false,
      isCameraOn: storeCoHost.hasVideo || false,
      isMicOn: true,
    });
  }

  // Listeners
  storeListeners.forEach((l) => {
    allParticipants.push({
      id: l.user.id,
      user: l.user,
      role: "participant",
      isLocal: false,
      isCameraOn: false,
      isMicOn: false,
    });
  });

  const activeSpeakers = new Set(activeSpeakerId ? [activeSpeakerId] : []);
  const participantCount = allParticipants.length;

  return (
    <RoomLayout
      insets={insets}
      connectionState={storeConnectionState}
      isHost={true}
      roomTitle={roomTitle}
      participantCount={participantCount}
      allParticipants={allParticipants}
      activeSpeakers={activeSpeakers}
      effectiveMuted={effectiveMuted}
      effectiveVideoOn={effectiveVideoOn}
      isHandRaised={isHandRaised}
      hasVideo={roomHasVideo}
      isChatOpen={isChatOpen}
      showEjectModal={showEjectModal}
      ejectPayload={ejectPayload}
      roomId={id}
      localUser={localUser}
      onLeave={handleLeave}
      onToggleMic={handleToggleMic}
      onToggleVideo={handleToggleVideo}
      onToggleHand={handleToggleHand}
      onChat={handleChat}
      onCloseChat={handleCloseChat}
      onEjectDismiss={handleEjectDismiss}
      onShare={handleShare}
      localRole="host"
    />
  );
}

// ── ServerRoom: full useVideoRoom for Fishjam-backed rooms ──────────

function ServerRoom({
  id,
  paramTitle,
  roomHasVideo = true,
  anonymous = false,
  initialRoom = null,
}: {
  id: string;
  paramTitle?: string;
  roomHasVideo?: boolean;
  anonymous?: boolean;
  initialRoom?: SneakyRoom | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const authUser = useAuthStore((s) => s.user);
  const endRoomHistory = useLynkHistoryStore((s) => s.endRoom);

  // VisionCamera permissions for native camera fallback
  const { requestPermission: requestCamPermission } = useCameraPermission();
  const { requestPermission: requestMicPermission } = useMicrophonePermission();

  const {
    isHandRaised,
    isChatOpen,
    showEjectModal,
    ejectPayload,
    listeners: storeListeners,
    toggleHand,
    setActiveSpeakerId,
    openChat,
    closeChat,
    showEject,
    hideEject,
    reset,
  } = useRoomStore();
  const [roomSnapshot, setRoomSnapshot] = useState<SneakyRoom | null>(
    initialRoom,
  );
  const [closedReason, setClosedReason] = useState<string | null>(
    initialRoom && (initialRoom.status === "ended" || !initialRoom.isLive)
      ? "This Lynk has ended and can't be reopened."
      : null,
  );
  const [roomMode, setRoomMode] = useState<"sweet" | "spicy">(
    initialRoom?.sweetSpicyMode || "sweet",
  );
  const [isUpdatingRoomMode, setIsUpdatingRoomMode] = useState(false);
  const [presenceEvent, setPresenceEvent] = useState<PresenceEvent | null>(
    null,
  );
  const presenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRoomClosed = useCallback(
    (room?: SneakyRoom | null, reason?: string) => {
      if (room) setRoomSnapshot(room);
      setClosedReason(reason || "This Lynk has ended and can't be reopened.");
      endRoomHistory(id, room?.listeners ?? storeListeners.length);
    },
    [endRoomHistory, id, storeListeners.length],
  );

  const videoRoom = useVideoRoom({
    roomId: id || "",
    anonymous,
    onEjected: (reason) => showEject(reason),
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended this room");
      markRoomClosed(roomSnapshot);
    },
    onError: (error) => {
      showToast("error", "Error", error);
      if (isClosedRoomError(error)) {
        const normalizedError = error.toLowerCase();
        markRoomClosed(
          undefined,
          normalizedError.includes("not found")
            ? "This Lynk is unavailable."
            : "This Lynk has ended and can't be reopened.",
        );
      }
    },
  });

  // When anonymous, use the anon label from the server response instead of real profile
  const localAnonLabel = normalizeAnonLabel(
    videoRoom.localUser?.anonLabel || videoRoom.localUser?.username,
  );
  const localUser: SneakyUser = videoRoom.localUser
    ? {
        id: videoRoom.localUser.id || authUser?.id || "local",
        username:
          videoRoom.localUser.isAnonymous && localAnonLabel
            ? localAnonLabel
            : videoRoom.localUser.username ||
              authUser?.username ||
              authUser?.name ||
              "Guest",
        displayName:
          videoRoom.localUser.isAnonymous && localAnonLabel
            ? localAnonLabel
            : videoRoom.localUser.username ||
              videoRoom.localUser.displayName ||
              authUser?.username ||
              authUser?.name ||
              "Guest",
        avatar: videoRoom.localUser.isAnonymous
          ? ""
          : videoRoom.localUser.avatar || authUser?.avatar || "",
        isVerified: videoRoom.localUser.isAnonymous
          ? false
          : authUser?.isVerified || false,
        isAnonymous: videoRoom.localUser.isAnonymous || false,
        anonLabel: videoRoom.localUser.isAnonymous ? localAnonLabel : null,
      }
    : buildLocalUser(authUser);
  const isHost = videoRoom.localUser?.role === "host";
  const effectiveMuted = !videoRoom.isMicOn;
  const effectiveVideoOn = videoRoom.isCameraOn;
  const connectionState =
    videoRoom.connectionState.status === "error"
      ? "disconnected"
      : (videoRoom.connectionState.status as
          | "connecting"
          | "connected"
          | "reconnecting"
          | "disconnected");
  const derivedRoomMode = (roomSnapshot?.sweetSpicyMode ||
    videoRoom.room?.sweetSpicyMode ||
    "sweet") as "sweet" | "spicy";

  useEffect(() => {
    if (isUpdatingRoomMode) return;
    setRoomMode(derivedRoomMode);
  }, [derivedRoomMode, isUpdatingRoomMode]);

  const showPresenceEvent = useCallback((tone: PresenceTone, label: string) => {
    if (presenceTimeoutRef.current) {
      clearTimeout(presenceTimeoutRef.current);
    }

    setPresenceEvent({
      id: `${tone}-${Date.now()}`,
      tone,
      label,
    });

    presenceTimeoutRef.current = setTimeout(() => {
      setPresenceEvent(null);
      presenceTimeoutRef.current = null;
    }, 2200);
  }, []);

  // Reset store on mount, request permissions
  useEffect(() => {
    reset();
    if (roomHasVideo) requestCamPermission();
    requestMicPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join Fishjam room on mount (media starts in separate effect below)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      audioSession.startForLynk(true);
      console.log("[SneakyLynk:Server] Joining room...", id);
      const joined = await videoRoom.join();
      if (!cancelled) {
        console.log("[SneakyLynk:Server] Join result:", joined);
        if (!joined) {
          const latestRoom = await sneakyLynkApi.getRoomById(id);
          if (cancelled) return;
          if (!latestRoom) {
            markRoomClosed(null, "This Lynk is unavailable.");
          } else if (latestRoom.status === "ended" || !latestRoom.isLive) {
            markRoomClosed(
              latestRoom,
              "This Lynk has ended and can't be reopened.",
            );
          } else {
            setRoomSnapshot(latestRoom);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      videoRoom.leave();
      audioSession.stop();
    };
  }, [id, markRoomClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`video_room_meta:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_rooms",
          filter: `uuid=eq.${id}`,
        },
        (payload) => {
          const room = payload.new as any;
          const nextMode =
            room?.sweet_spicy_mode === "spicy" ? "spicy" : "sweet";

          setRoomSnapshot((prev) => ({
            id: prev?.id || room.uuid || id,
            createdBy: prev?.createdBy || room.created_by || "",
            title: room.title || prev?.title || paramTitle || "Sneaky Lynk",
            topic: room.topic || prev?.topic || "",
            description: room.description || prev?.description || "",
            sweetSpicyMode: nextMode,
            isLive: room.status === "open",
            hasVideo: room.has_video ?? prev?.hasVideo ?? roomHasVideo,
            isPublic: room.is_public ?? prev?.isPublic ?? true,
            status: room.status === "ended" ? "ended" : "open",
            createdAt: room.created_at || prev?.createdAt || "",
            endedAt: room.ended_at || prev?.endedAt || undefined,
            host: prev?.host || {
              id: "",
              username: "unknown",
              displayName: "unknown",
              avatar: "",
              isVerified: false,
            },
            speakers: prev?.speakers || [],
            listeners: room.participant_count ?? prev?.listeners ?? 0,
            fishjamRoomId:
              room.fishjam_room_id || prev?.fishjamRoomId || undefined,
          }));

          if (!isUpdatingRoomMode) {
            setRoomMode(nextMode);
          }

          if (room.status === "ended") {
            setClosedReason("This Lynk has ended and can't be reopened.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isUpdatingRoomMode, paramTitle, roomHasVideo]);

  useEffect(() => {
    if (!id || !videoRoom.localUser?.id) return;

    const unsubscribe = videoApi.subscribeToMembers(id, (member, eventType) => {
      if (member.userId === videoRoom.localUser?.id) return;

      const label =
        member.anonLabel || member.displayName || member.username || "Someone";

      if (eventType === "INSERT" && member.status === "active") {
        showPresenceEvent("join", `${label} joined`);
      }

      if (
        eventType === "UPDATE" &&
        (member.status === "left" ||
          member.status === "kicked" ||
          member.status === "banned")
      ) {
        showPresenceEvent("leave", `${label} left`);
      }
    });

    return () => {
      unsubscribe?.();
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
        presenceTimeoutRef.current = null;
      }
    };
  }, [id, showPresenceEvent, videoRoom.localUser?.id]);

  // Start camera + mic ONLY after Fishjam peer is fully connected.
  // toggleCamera/toggleMic must be called when peerStatus === "connected",
  // otherwise the Fishjam SDK creates local tracks but never publishes them.
  const mediaStartedRef = React.useRef(false);
  useEffect(() => {
    if (connectionState !== "connected" || mediaStartedRef.current) return;
    mediaStartedRef.current = true;

    (async () => {
      try {
        console.log(
          "[SneakyLynk:Server] Peer connected — starting media, isHost:",
          isHost,
        );
        audioSession.setSpeakerOn(true);
        if (roomHasVideo) {
          console.log("[SneakyLynk:Server] Starting camera...");
          await videoRoom.toggleCamera();
        }
        if (!videoRoom.isMicOn) {
          console.log("[SneakyLynk:Server] Starting mic...");
          await videoRoom.toggleMic();
        }
        console.log(
          "[SneakyLynk:Server] Media started for",
          isHost ? "host" : "participant",
        );
      } catch (e) {
        console.warn("[SneakyLynk:Server] Failed to start media:", e);
      }
    })();
  }, [connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net: if remote peers joined but our mic never published, force it on.
  useEffect(() => {
    if (connectionState !== "connected") return;
    if (videoRoom.participants.length === 0) return;
    if (videoRoom.isMicOn || videoRoom.microphone.isMicrophoneOn) return;

    const timer = setTimeout(async () => {
      if (videoRoom.isMicOn || videoRoom.microphone.isMicrophoneOn) return;
      console.warn(
        "[SneakyLynk:Server] MIC_SAFETY: remote peers present but mic is still off, force-starting",
      );
      try {
        await videoRoom.toggleMic();
      } catch (error) {
        console.warn("[SneakyLynk:Server] MIC_SAFETY failed:", error);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [
    connectionState,
    videoRoom.participants.length,
    videoRoom.isMicOn,
    videoRoom.microphone.isMicrophoneOn,
    videoRoom.toggleMic,
  ]);

  // Speaking indicator - only clear when muted, don't auto-set when unmuted
  // Actual voice activity detection should come from Fishjam SDK
  useEffect(() => {
    if (effectiveMuted) {
      setActiveSpeakerId(null as any);
    }
    // Removed: auto-setting localUser.id as active speaker when unmuted
    // This caused talk animation to show constantly even when not speaking
  }, [effectiveMuted, setActiveSpeakerId]);

  const roomTitle =
    videoRoom.room?.title || roomSnapshot?.title || paramTitle || "Room";

  const handleLeave = useCallback(async () => {
    if (isHost) {
      // Host ends the room for everyone
      const result = await sneakyLynkApi.endRoom(id);
      if (!result.ok && !isClosedRoomError(result.error?.message)) {
        console.error(
          "[SneakyLynk:Server] Failed to end room in DB:",
          result.error?.message,
        );
        showToast(
          "error",
          "Couldn't close Lynk",
          result.error?.message || "Try again. The Lynk is still open.",
        );
        return;
      }

      if (result.ok) {
        console.log("[SneakyLynk:Server] Room ended in DB:", id);
      } else {
        console.warn(
          "[SneakyLynk:Server] Room already closed or unavailable:",
          result.error?.message,
        );
      }
    } else {
      // Non-host: leave room (decrement participant_count, auto-end if empty)
      const result = await sneakyLynkApi.leaveRoom(id);
      if (!result.ok && !isClosedRoomError(result.error?.message)) {
        console.error(
          "[SneakyLynk:Server] Failed to leave room in DB:",
          result.error?.message,
        );
        showToast(
          "error",
          "Couldn't leave Lynk",
          result.error?.message || "Try again.",
        );
        return;
      }

      if (result.ok) {
        console.log("[SneakyLynk:Server] Left room in DB:", id);
      } else {
        console.warn(
          "[SneakyLynk:Server] Room already closed or unavailable:",
          result.error?.message,
        );
      }
    }
    endRoomHistory(id, storeListeners.length);
    router.back();
  }, [router, id, endRoomHistory, storeListeners.length, isHost, showToast]);
  const handleToggleMic = useCallback(async () => {
    await videoRoom.toggleMic();
  }, [videoRoom]);
  const handleToggleVideo = useCallback(async () => {
    await videoRoom.toggleCamera();
  }, [videoRoom]);
  const handleSwitchCamera = useCallback(async () => {
    await videoRoom.switchCamera();
  }, [videoRoom]);
  const handleToggleHand = useCallback(() => toggleHand(), [toggleHand]);
  const handleChat = useCallback(() => openChat(), [openChat]);
  const handleCloseChat = useCallback(() => closeChat(), [closeChat]);
  const handleShare = useCallback(async () => {
    await shareUrl(buildLynkShareUrl(id), {
      title: roomTitle,
      message: `Jump into "${roomTitle}" on DVNT\n${buildLynkShareUrl(id)}`,
    });
  }, [id, roomTitle]);
  const handleEjectDismiss = useCallback(() => {
    hideEject();
    router.back();
  }, [router, hideEject]);

  // ── CRITICAL: All useState MUST be called BEFORE early returns ────
  const [actionTarget, setActionTarget] = useState<VideoParticipant | null>(
    null,
  );
  const [allMuted, setAllMuted] = useState(false);
  const [showParticipantsSheet, setShowParticipantsSheet] = useState(false);

  // ── Derived values that depend on videoRoom (also before early return) ─
  const roomUuid = videoRoom.room?.id || id;
  const handleRoomModeChange = useCallback(
    async (nextMode: "sweet" | "spicy") => {
      if (!isHost || nextMode === roomMode) return;

      const previousMode = roomMode;
      setIsUpdatingRoomMode(true);
      setRoomMode(nextMode);
      setRoomSnapshot((prev) =>
        prev ? { ...prev, sweetSpicyMode: nextMode } : prev,
      );

      const result = await sneakyLynkApi.setRoomMode(id, nextMode);

      if (!result.ok) {
        setRoomMode(previousMode);
        setRoomSnapshot((prev) =>
          prev ? { ...prev, sweetSpicyMode: previousMode } : prev,
        );
        showToast(
          "error",
          "Mode Update Failed",
          result.error?.message || "Couldn't update room mode.",
        );
        setIsUpdatingRoomMode(false);
        return;
      }

      const confirmedMode = result.data?.mode || nextMode;
      setRoomMode(confirmedMode);
      setRoomSnapshot((prev) =>
        prev ? { ...prev, sweetSpicyMode: confirmedMode } : prev,
      );
      setIsUpdatingRoomMode(false);
    },
    [id, isHost, roomMode, showToast],
  );

  // ── CRITICAL: All useCallback handlers BEFORE early return ────────
  const handleMutePeer = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.mutePeer({ roomId: roomUuid, targetUserId });
      if (res.ok) {
        showToast("info", "Muted", "Participant has been muted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to mute");
      }
    },
    [roomUuid, showToast],
  );

  const handleToggleMuteAll = useCallback(async () => {
    if (allMuted) {
      const res = await videoApi.unmuteAll(roomUuid);
      if (res.ok) {
        setAllMuted(false);
        showToast("info", "Unmuted All", "All participants have been unmuted");
      } else {
        showToast(
          "error",
          "Error",
          res.error?.message || "Failed to unmute all",
        );
      }
    } else {
      const res = await videoApi.muteAll(roomUuid);
      if (res.ok) {
        setAllMuted(true);
        showToast("info", "Muted All", "All participants have been muted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to mute all");
      }
    }
  }, [roomUuid, allMuted, showToast]);

  const handleUnmutePeer = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.unmutePeer({ roomId: roomUuid, targetUserId });
      if (res.ok) {
        showToast("info", "Unmuted", "Participant has been unmuted");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to unmute");
      }
    },
    [roomUuid, showToast],
  );

  const handleMakeCoHost = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.changeRole({
        roomId: roomUuid,
        targetUserId,
        newRole: "co-host",
      });
      if (res.ok) {
        showToast("info", "Promoted", "User is now a co-host");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to promote");
      }
    },
    [roomUuid, showToast],
  );

  const handleDemote = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.changeRole({
        roomId: roomUuid,
        targetUserId,
        newRole: "participant",
      });
      if (res.ok) {
        showToast("info", "Demoted", "User is now a participant");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to demote");
      }
    },
    [roomUuid, showToast],
  );

  const handleRemoveUser = useCallback(
    async (targetUserId: string) => {
      const res = await videoApi.kickUser({
        roomId: roomUuid,
        targetUserId,
        reason: "Removed by host",
      });
      if (res.ok) {
        showToast("info", "Removed", "User has been removed from the room");
      } else {
        showToast("error", "Error", res.error?.message || "Failed to remove");
      }
    },
    [roomUuid, showToast],
  );

  const handleParticipantPress = useCallback((p: VideoParticipant) => {
    setActionTarget(p);
  }, []);

  if (closedReason) {
    return (
      <ClosedRoomScreen
        roomTitle={roomSnapshot?.title || paramTitle || "Sneaky Lynk"}
        message={closedReason}
        onBack={() => router.back()}
      />
    );
  }

  // ── EARLY RETURN: Only after ALL hooks have been called ───────────
  if (connectionState === "connecting" || connectionState === "disconnected") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FC253A" />
        <Text className="text-foreground mt-4">
          {connectionState === "connecting"
            ? "Joining room..."
            : "Preparing room..."}
        </Text>
      </View>
    );
  }

  // Build SneakyUser from a Fishjam participant
  const peerToUser = (p: any): SneakyUser => {
    const anonLabel = normalizeAnonLabel(p.anonLabel || p.username);
    const name = anonLabel || p.username || p.displayName || "Guest";
    const isAnon = !!(p.isAnonymous || anonLabel);
    return {
      id: p.userId || p.oderId || p.odId,
      username: name,
      displayName: name,
      avatar: isAnon ? "" : p.avatar || "",
      isVerified: false,
      isAnonymous: isAnon,
      anonLabel: isAnon ? anonLabel : null,
    };
  };

  // ── Build flat VideoParticipant[] for VideoGrid ──────────────────
  const remotePeers = videoRoom.participants || [];
  const localCameraStream = videoRoom.camera?.cameraStream || null;

  const allParticipants: VideoParticipant[] = [];

  // Local user first (always shown at top-left)
  allParticipants.push({
    id: localUser.id,
    user: localUser,
    role: isHost ? "host" : videoRoom.localUser?.role || "participant",
    isLocal: true,
    isCameraOn: effectiveVideoOn,
    isMicOn: !effectiveMuted,
    videoTrack: localCameraStream ? { stream: localCameraStream } : undefined,
  });

  // Remote peers - exclude local user to prevent duplicates
  remotePeers.forEach((p: any) => {
    const peerId = p.userId || p.oderId || p.odId;
    // Skip if this is actually the local user (prevents duplicate)
    if (peerId === localUser.id || peerId === authUser?.id) return;

    allParticipants.push({
      id: peerId,
      user: peerToUser(p),
      role: p.role || "participant",
      isLocal: false,
      isCameraOn: p.isCameraOn || false,
      isMicOn: p.isMicOn || false,
      videoTrack: p.videoTrack,
      audioTrack: p.audioTrack,
    });
  });

  // Active speakers - should be set by voice activity detection, not mic state
  const activeSpeakerIds = new Set<string>();
  // Removed auto-adding based on mic state - causes talk animation when not speaking
  // Voice activity detection should come from Fishjam SDK
  remotePeers.forEach((p: any) => {
    // Only add if actually speaking (voice activity), not just unmuted
    if (p.isSpeaking) activeSpeakerIds.add(p.userId || p.oderId || p.odId);
  });

  const totalParticipants = allParticipants.length;

  return (
    <>
      <RoomLayout
        insets={insets}
        connectionState={connectionState}
        isHost={!!isHost}
        roomTitle={roomTitle}
        participantCount={totalParticipants}
        allParticipants={allParticipants}
        activeSpeakers={activeSpeakerIds}
        effectiveMuted={effectiveMuted}
        effectiveVideoOn={effectiveVideoOn}
        isHandRaised={isHandRaised}
        hasVideo={roomHasVideo}
        isChatOpen={isChatOpen}
        showEjectModal={showEjectModal}
        ejectPayload={ejectPayload}
        roomId={id}
        localUser={localUser}
        presenceEvent={presenceEvent}
        onLeave={handleLeave}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onSwitchCamera={roomHasVideo ? handleSwitchCamera : undefined}
        onToggleHand={handleToggleHand}
        onChat={handleChat}
        onCloseChat={handleCloseChat}
        onEjectDismiss={handleEjectDismiss}
        onParticipantPress={isHost ? handleParticipantPress : undefined}
        onMuteAll={isHost ? handleToggleMuteAll : undefined}
        allMuted={allMuted}
        onShare={handleShare}
        localRole={isHost ? "host" : "participant"}
        canOpenParticipants={isHost}
        onOpenParticipants={
          isHost ? () => setShowParticipantsSheet(true) : undefined
        }
      />

      <RoomParticipantsSheet
        visible={showParticipantsSheet}
        participants={allParticipants}
        localUserId={localUser.id}
        isHost={isHost}
        onDismiss={() => setShowParticipantsSheet(false)}
        onMute={handleMutePeer}
        onUnmute={handleUnmutePeer}
        onRemove={handleRemoveUser}
      />

      {/* Host action sheet — mute / co-host / remove */}
      <ParticipantActions
        visible={!!actionTarget}
        participant={
          actionTarget
            ? {
                userId: actionTarget.id,
                user: actionTarget.user,
                role: actionTarget.role,
                isMicOn: actionTarget.isMicOn,
              }
            : null
        }
        onMute={handleMutePeer}
        onUnmute={handleUnmutePeer}
        onMakeCoHost={handleMakeCoHost}
        onDemote={handleDemote}
        onRemove={handleRemoveUser}
        onClose={() => setActionTarget(null)}
      />
    </>
  );
}

// ── Shared Room Layout (pure presentation) ──────────────────────────

function RoomLayout({
  insets,
  connectionState,
  isHost,
  roomTitle,
  participantCount,
  allParticipants,
  activeSpeakers,
  effectiveMuted,
  effectiveVideoOn,
  isHandRaised,
  hasVideo,
  isChatOpen,
  showEjectModal,
  ejectPayload,
  roomId,
  localUser,
  presenceEvent,
  onLeave,
  onToggleMic,
  onToggleVideo,
  onSwitchCamera,
  onToggleHand,
  onChat,
  onCloseChat,
  onEjectDismiss,
  onShare,
  onParticipantPress,
  onMuteAll,
  allMuted,
  localRole,
  canOpenParticipants,
  onOpenParticipants,
}: {
  insets: any;
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  isHost: boolean;
  localRole: "host" | "co-host" | "participant";
  roomTitle: string;
  participantCount: number;
  allParticipants: VideoParticipant[];
  activeSpeakers: Set<string>;
  effectiveMuted: boolean;
  effectiveVideoOn: boolean;
  isHandRaised: boolean;
  hasVideo?: boolean;
  isChatOpen: boolean;
  showEjectModal: boolean;
  ejectPayload: any;
  roomId: string;
  localUser: SneakyUser;
  presenceEvent?: PresenceEvent | null;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onSwitchCamera?: () => void;
  onToggleHand: () => void;
  onChat: () => void;
  onCloseChat: () => void;
  onEjectDismiss: () => void;
  onShare?: () => void;
  onParticipantPress?: (p: VideoParticipant) => void;
  onMuteAll?: () => void;
  allMuted?: boolean;
  canOpenParticipants?: boolean;
  onOpenParticipants?: () => void;
}) {
  const { reactions, sendReaction } = useRoomReactions({
    roomId,
    currentUser: localUser,
  });

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={["#090B10", "#0C1118", "#05070B"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <LinearGradient
        colors={[
          "rgba(56, 189, 248, 0.12)",
          "rgba(14, 165, 233, 0.02)",
          "transparent",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={{
          position: "absolute",
          top: -80,
          left: -30,
          width: 280,
          height: 240,
          borderRadius: 180,
        }}
      />

      <ConnectionBanner state={connectionState} />
      {presenceEvent ? <PresenceToast event={presenceEvent} /> : null}

      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View
          style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Pressable onPress={onLeave} hitSlop={12}>
              <DVNTLiquidGlassIconButton
                size={42}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.16)",
                }}
              >
                <ArrowLeft size={20} color="#F8FAFC" />
              </DVNTLiquidGlassIconButton>
            </Pressable>

            <DVNTLiquidGlass
              radius={20}
              paddingH={12}
              paddingV={10}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
                backgroundColor: "rgba(5, 10, 22, 0.22)",
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: 12,
                        backgroundColor: "rgba(239, 68, 68, 0.18)",
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: "#FB7185",
                        }}
                      />
                      <Text
                        style={{
                          color: "#FCA5A5",
                          fontSize: 10,
                          fontWeight: "800",
                          letterSpacing: 0.4,
                        }}
                      >
                        LIVE
                      </Text>
                    </View>
                    {isHost ? (
                      <View
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 5,
                          borderRadius: 12,
                          backgroundColor: "rgba(59, 130, 246, 0.18)",
                        }}
                      >
                        <Text
                          style={{
                            color: "#BFDBFE",
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          HOST
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {canOpenParticipants && onOpenParticipants ? (
                    <Pressable onPress={onOpenParticipants}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          paddingHorizontal: 9,
                          paddingVertical: 5,
                          borderRadius: 12,
                          backgroundColor: "rgba(255,255,255,0.07)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Users size={13} color="#CBD5E1" />
                        <Text
                          style={{
                            color: "#E2E8F0",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {participantCount}
                        </Text>
                        <ChevronUp size={11} color="#94A3B8" />
                      </View>
                    </Pressable>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Users size={13} color="#94A3B8" />
                      <Text
                        style={{
                          color: "#CBD5E1",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {participantCount}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={{
                    color: "#F8FAFC",
                    fontSize: 16,
                    fontWeight: "800",
                  }}
                  numberOfLines={1}
                >
                  {roomTitle}
                </Text>
              </View>
            </DVNTLiquidGlass>

            {isHost && onMuteAll ? (
              <Pressable onPress={onMuteAll} hitSlop={10}>
                <DVNTLiquidGlassIconButton
                  size={42}
                  style={{
                    backgroundColor: "rgba(5, 10, 22, 0.22)",
                    borderWidth: 1,
                    borderColor: allMuted
                      ? "rgba(45, 212, 191, 0.24)"
                      : "rgba(248, 113, 113, 0.24)",
                  }}
                >
                  {allMuted ? (
                    <Mic size={17} color="#5EEAD4" />
                  ) : (
                    <MicOff size={17} color="#FCA5A5" />
                  )}
                </DVNTLiquidGlassIconButton>
              </Pressable>
            ) : (
              <View style={{ width: 42 }} />
            )}
          </View>
        </View>

        <View
          className="flex-1"
          style={{ paddingHorizontal: 6, paddingBottom: 126 }}
        >
          <VideoGrid
            participants={allParticipants}
            activeSpeakers={activeSpeakers}
            isHost={isHost}
            onParticipantPress={onParticipantPress}
          />
        </View>

        <RoomTimer onTimeUp={onLeave} />

        <ControlsBar
          isMuted={effectiveMuted}
          isVideoEnabled={effectiveVideoOn}
          handRaised={isHandRaised}
          hasVideo={hasVideo ?? true}
          localRole={localRole}
          floatingReactions={reactions}
          onLeave={onLeave}
          onToggleMute={onToggleMic}
          onToggleVideo={onToggleVideo}
          onToggleHand={onToggleHand}
          onOpenChat={onChat}
          onShare={onShare}
          onSwitchCamera={onSwitchCamera}
          onSendReaction={sendReaction}
        />

        <EjectModal
          visible={showEjectModal}
          payload={ejectPayload}
          onDismiss={onEjectDismiss}
        />

        <ChatSheet
          isOpen={isChatOpen}
          onClose={onCloseChat}
          roomId={roomId}
          currentUser={localUser}
          participants={allParticipants.map((p) => p.user)}
        />
      </View>
    </View>
  );
}

export default function SneakyLynkRoomScreen() {
  const router = useRouter();
  return (
    <GlobalErrorBoundary
      screenName="SneakyLynkRoom"
      onGoBack={() => router.back()}
    >
      <SneakyLynkRoomScreenContent />
    </GlobalErrorBoundary>
  );
}
