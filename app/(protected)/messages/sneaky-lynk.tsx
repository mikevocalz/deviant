/**
 * Sneaky Lynk List Screen
 * Audio-first live rooms with optional video stage
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Radio, Plus } from "lucide-react-native";

import { TopicPills, LiveRoomCard } from "@/src/sneaky-lynk/ui";
import { mockSpaces, type Topic } from "@/src/sneaky-lynk/mocks/data";
import { EmptyState } from "@/components/ui/empty-state";

export default function SneakyLynkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<Topic>("All");

  // Filter spaces by topic
  // TODO: Replace with real Supabase query
  const liveSpaces = mockSpaces.filter((space) => {
    if (!space.isLive) return false;
    if (selectedTopic === "All") return true;
    return space.topic === selectedTopic;
  });

  const handleRoomPress = useCallback(
    (roomId: string) => {
      router.push(`/messages/sneaky-lynk/room/${roomId}` as any);
    },
    [router],
  );

  const handleCreateRoom = useCallback(() => {
    // TODO: Implement create room modal/screen
    console.log("[SneakyLynk] Create room pressed");
  }, []);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
        <View className="flex-row items-center gap-2.5">
          <Radio size={28} color="#FF6DC1" />
          <Text className="text-[28px] font-extrabold text-foreground tracking-tight">
            Sneaky Lynk
          </Text>
        </View>
        <Pressable
          onPress={handleCreateRoom}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
        >
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Topic Pills */}
      <TopicPills
        selectedTopic={selectedTopic}
        onSelectTopic={setSelectedTopic}
      />

      {/* Live Rooms List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
      >
        {liveSpaces.length > 0 ? (
          liveSpaces.map((space) => (
            <LiveRoomCard
              key={space.id}
              space={space}
              onPress={() => handleRoomPress(space.id)}
            />
          ))
        ) : (
          <View className="pt-20">
            <EmptyState
              icon={Radio}
              title="No Live Rooms"
              description="Check back later for live conversations"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
