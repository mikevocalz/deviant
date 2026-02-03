/**
 * Video Room Screen
 * Main video call interface with participants grid, controls, and moderation
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  BackHandler,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import { useVideoRoom } from "@/src/video/hooks/useVideoRoom";
import {
  VideoTile,
  VideoTileSkeleton,
  ControlsBar,
  ParticipantsSheet,
  ConnectionBanner,
  EjectModal,
  ConfirmKickModal,
  ConfirmBanModal,
  EndRoomModal,
  c,
} from "@/src/video/ui";
import { useUIStore } from "@/lib/stores/ui-store";

export default function VideoRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  // Using type assertion to satisfy BottomSheet ref requirements
  const participantsSheetRef = useRef<BottomSheet>(null!);

  const [showEndRoomModal, setShowEndRoomModal] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [banTarget, setBanTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const {
    room,
    localUser,
    participants,
    connectionState,
    isCameraOn,
    isMicOn,
    isEjected,
    ejectReason,
    join,
    leave,
    toggleCamera,
    toggleMic,
    switchCamera,
    kickUser,
    banUser,
    endRoom,
  } = useVideoRoom({
    roomId: roomId!,
    onEjected: (reason) => {
      showToast(
        "error",
        reason.action === "ban" ? "Banned" : "Removed",
        reason.reason || "You have been removed from the room",
      );
    },
    onRoomEnded: () => {
      showToast("info", "Room Ended", "The host has ended the call");
      router.back();
    },
    onError: (error) => {
      showToast("error", "Error", error);
    },
  });

  // Join room on mount
  useEffect(() => {
    join();
    return () => {
      leave();
    };
  }, []);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleLeave();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [localUser?.role]);

  const handleLeave = useCallback(() => {
    if (localUser?.role === "host") {
      setShowEndRoomModal(true);
    } else {
      leave();
      router.back();
    }
  }, [localUser?.role, leave]);

  const handleEndRoom = useCallback(async () => {
    setShowEndRoomModal(false);
    const success = await endRoom();
    if (success) {
      router.back();
    }
  }, [endRoom]);

  const handleKick = useCallback(
    async (userId: string) => {
      const participant = participants.find((p) => p.userId === userId);
      if (participant) {
        setKickTarget({ userId, username: participant.username || "User" });
      }
    },
    [participants],
  );

  const handleBan = useCallback(
    async (userId: string) => {
      const participant = participants.find((p) => p.userId === userId);
      if (participant) {
        setBanTarget({ userId, username: participant.username || "User" });
      }
    },
    [participants],
  );

  const confirmKick = useCallback(async () => {
    if (kickTarget) {
      await kickUser(kickTarget.userId);
      setKickTarget(null);
    }
  }, [kickTarget, kickUser]);

  const confirmBan = useCallback(
    async (durationMinutes?: number) => {
      if (banTarget) {
        await banUser(banTarget.userId, undefined, durationMinutes);
        setBanTarget(null);
      }
    },
    [banTarget, banUser],
  );

  const showParticipants = useCallback(() => {
    participantsSheetRef.current?.expand();
  }, []);

  const hideParticipants = useCallback(() => {
    participantsSheetRef.current?.close();
  }, []);

  // Grid layout for participants
  const gridLayout = getGridLayout(participants.length + 1); // +1 for local user

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Connection Banner */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
      >
        <View className="px-4 pt-2">
          <ConnectionBanner connectionState={connectionState} />
        </View>
      </SafeAreaView>

      {/* Room Title */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
      >
        <View className="px-4 pt-12">
          <Text className="text-white/80 text-center font-medium">
            {room?.title || "Video Room"}
          </Text>
        </View>
      </SafeAreaView>

      {/* Video Grid */}
      <View
        className="flex-1 p-2"
        style={{ paddingTop: 80, paddingBottom: 100 }}
      >
        {connectionState.status === "connecting" ? (
          <View className="flex-1 flex-row flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  width: gridLayout.tileWidth,
                  height: gridLayout.tileHeight,
                }}
              >
                <VideoTileSkeleton isLarge={participants.length <= 1} />
              </View>
            ))}
          </View>
        ) : (
          <View className="flex-1 flex-row flex-wrap gap-2 justify-center content-center">
            {/* Local User Tile */}
            <View
              style={{
                width: gridLayout.tileWidth,
                height: gridLayout.tileHeight,
              }}
            >
              <VideoTile
                participant={{
                  odId: "local",
                  oderId: "local",
                  userId: localUser?.id || "",
                  username: localUser?.username,
                  avatar: localUser?.avatar,
                  role: localUser?.role || "participant",
                  isLocal: true,
                  isCameraOn,
                  isMicOn,
                  isScreenSharing: false,
                }}
                isLarge={participants.length === 0}
              />
            </View>

            {/* Remote Participants */}
            {participants.map((participant) => (
              <View
                key={participant.userId}
                style={{
                  width: gridLayout.tileWidth,
                  height: gridLayout.tileHeight,
                }}
              >
                <VideoTile
                  participant={participant}
                  isLarge={participants.length === 1}
                  onLongPress={
                    (localUser?.role === "host" ||
                      localUser?.role === "moderator") &&
                    participant.role !== "host"
                      ? () => handleKick(participant.userId)
                      : undefined
                  }
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Controls Bar */}
      <ControlsBar
        isCameraOn={isCameraOn}
        isMicOn={isMicOn}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
        onSwitchCamera={switchCamera}
        onEndCall={handleLeave}
        onShowParticipants={showParticipants}
        isHost={localUser?.role === "host"}
      />

      {/* Participants Sheet */}
      <ParticipantsSheet
        bottomSheetRef={participantsSheetRef}
        participants={participants}
        localUserId={localUser?.id || ""}
        localUserRole={localUser?.role || "participant"}
        onKick={handleKick}
        onBan={handleBan}
        onClose={hideParticipants}
      />

      {/* Modals */}
      <EjectModal
        visible={isEjected}
        ejectReason={ejectReason}
        onDismiss={() => router.back()}
      />

      <ConfirmKickModal
        visible={!!kickTarget}
        username={kickTarget?.username || ""}
        onConfirm={confirmKick}
        onCancel={() => setKickTarget(null)}
      />

      <ConfirmBanModal
        visible={!!banTarget}
        username={banTarget?.username || ""}
        onConfirm={confirmBan}
        onCancel={() => setBanTarget(null)}
      />

      <EndRoomModal
        visible={showEndRoomModal}
        onConfirm={handleEndRoom}
        onCancel={() => setShowEndRoomModal(false)}
      />
    </View>
  );
}

function getGridLayout(count: number) {
  // Calculate optimal grid layout based on participant count
  // Use numeric values for proper DimensionValue typing
  const { width, height } = Dimensions.get("window");
  const containerWidth = width - 16; // Account for padding
  const containerHeight = height - 200; // Account for header and controls

  if (count <= 1) {
    return {
      cols: 1,
      rows: 1,
      tileWidth: containerWidth,
      tileHeight: containerHeight,
    };
  }
  if (count === 2) {
    return {
      cols: 1,
      rows: 2,
      tileWidth: containerWidth,
      tileHeight: containerHeight * 0.48,
    };
  }
  if (count <= 4) {
    return {
      cols: 2,
      rows: 2,
      tileWidth: containerWidth * 0.48,
      tileHeight: containerHeight * 0.48,
    };
  }
  if (count <= 6) {
    return {
      cols: 2,
      rows: 3,
      tileWidth: containerWidth * 0.48,
      tileHeight: containerHeight * 0.32,
    };
  }
  if (count <= 9) {
    return {
      cols: 3,
      rows: 3,
      tileWidth: containerWidth * 0.32,
      tileHeight: containerHeight * 0.32,
    };
  }
  // For larger groups, use scrollable grid
  return {
    cols: 3,
    rows: Math.ceil(count / 3),
    tileWidth: containerWidth * 0.32,
    tileHeight: containerHeight * 0.32,
  };
}
