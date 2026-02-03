/**
 * Video Rooms List Screen
 * Shows public rooms and user's active rooms
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video,
  Plus,
  Users,
  Lock,
  Globe,
  ChevronRight,
  X,
} from "lucide-react-native";
import { videoApi } from "@/src/video/api";
import { c } from "@/src/video/ui/styles";
import type { VideoRoom } from "@/src/video/types";

export default function RoomsScreen() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: publicRooms,
    isLoading: loadingPublic,
    refetch: refetchPublic,
  } = useQuery({
    queryKey: ["videoRooms", "public"],
    queryFn: () => videoApi.getPublicRooms(),
  });

  const {
    data: myRooms,
    isLoading: loadingMy,
    refetch: refetchMy,
  } = useQuery({
    queryKey: ["videoRooms", "my"],
    queryFn: () => videoApi.getMyRooms(),
  });

  const isLoading = loadingPublic || loadingMy;

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchPublic(), refetchMy()]);
  }, [refetchPublic, refetchMy]);

  const handleJoinRoom = (roomId: string) => {
    router.push(`/(video)/room/${roomId}`);
  };

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Video size={24} color="rgb(var(--primary))" />
          <Text className={c.textTitle}>Video Rooms</Text>
        </View>
        <Pressable
          className={c.btnPrimary}
          style={{ paddingHorizontal: 16, paddingVertical: 10 }}
          onPress={handleCreateRoom}
        >
          <View className="flex-row items-center gap-2">
            <Plus size={18} color="#fff" />
            <Text className="text-white font-semibold">Create</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {/* My Active Rooms */}
        {myRooms && myRooms.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Your Active Rooms
            </Text>
            {myRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onPress={() => handleJoinRoom(room.id)}
              />
            ))}
          </View>
        )}

        {/* Public Rooms */}
        <View>
          <Text className="text-lg font-semibold text-foreground mb-3">
            Public Rooms
          </Text>
          {publicRooms && publicRooms.length > 0 ? (
            publicRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onPress={() => handleJoinRoom(room.id)}
              />
            ))
          ) : (
            <View className={c.emptyState}>
              <Globe size={48} color="rgb(var(--muted-foreground))" />
              <Text className="text-muted-foreground mt-4 text-center">
                No public rooms available.{"\n"}Create one to get started!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(roomId) => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["videoRooms"] });
            handleJoinRoom(roomId);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function RoomCard({ room, onPress }: { room: VideoRoom; onPress: () => void }) {
  return (
    <Pressable
      className={`${c.card} p-4 mb-3 active:opacity-80`}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            {room.isPublic ? (
              <Globe size={14} color="rgb(var(--muted-foreground))" />
            ) : (
              <Lock size={14} color="rgb(var(--muted-foreground))" />
            )}
            <Text className={c.textSubtitle} numberOfLines={1}>
              {room.title}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Users size={12} color="rgb(var(--muted-foreground))" />
            <Text className={c.textSmall}>
              Max {room.maxParticipants} participants
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color="rgb(var(--muted-foreground))" />
      </View>
    </Pressable>
  );
}

function CreateRoomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(10);

  const createMutation = useMutation({
    mutationFn: () =>
      videoApi.createRoom({ title, isPublic, maxParticipants }),
    onSuccess: (result) => {
      if (result.ok && result.data) {
        onCreated(result.data.room.id);
      }
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate();
  };

  return (
    <View className="absolute inset-0 bg-black/70 items-center justify-center">
      <View className={`${c.cardGlass} w-[90%] max-w-md p-6`}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className={c.textTitle}>Create Room</Text>
          <Pressable onPress={onClose}>
            <X size={24} color="rgb(var(--muted-foreground))" />
          </Pressable>
        </View>

        {/* Title Input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-2">
            Room Title
          </Text>
          <TextInput
            className="bg-muted rounded-xl px-4 py-3 text-foreground"
            placeholder="Enter room title..."
            placeholderTextColor="rgb(var(--muted-foreground))"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Public Toggle */}
        <Pressable
          className="flex-row items-center justify-between mb-4 p-3 bg-muted rounded-xl"
          onPress={() => setIsPublic(!isPublic)}
        >
          <View className="flex-row items-center gap-3">
            {isPublic ? (
              <Globe size={20} color="rgb(var(--primary))" />
            ) : (
              <Lock size={20} color="rgb(var(--muted-foreground))" />
            )}
            <View>
              <Text className="text-foreground font-medium">
                {isPublic ? "Public Room" : "Private Room"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {isPublic
                  ? "Anyone can discover and join"
                  : "Only invited users can join"}
              </Text>
            </View>
          </View>
          <View
            className={`w-12 h-7 rounded-full ${isPublic ? "bg-primary" : "bg-muted-foreground/30"} justify-center`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white ${isPublic ? "ml-6" : "ml-1"}`}
            />
          </View>
        </Pressable>

        {/* Max Participants */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-2">
            Max Participants: {maxParticipants}
          </Text>
          <View className="flex-row gap-2">
            {[2, 5, 10, 20, 50].map((num) => (
              <Pressable
                key={num}
                className={`flex-1 py-2 rounded-lg ${maxParticipants === num ? "bg-primary" : "bg-muted"}`}
                onPress={() => setMaxParticipants(num)}
              >
                <Text
                  className={`text-center font-medium ${maxParticipants === num ? "text-white" : "text-muted-foreground"}`}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Error */}
        {createMutation.error && (
          <Text className="text-destructive text-sm mb-4">
            Failed to create room. Please try again.
          </Text>
        )}

        {/* Create Button */}
        <Pressable
          className={`${c.btnPrimary} ${!title.trim() || createMutation.isPending ? "opacity-50" : ""}`}
          onPress={handleCreate}
          disabled={!title.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Create Room</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
