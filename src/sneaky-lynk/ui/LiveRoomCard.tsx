/**
 * Live Room Card Component
 * Gradient card displaying a live Sneaky Lynk room
 */

import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Video, Users } from "lucide-react-native";
import type { MockSpace } from "../types";

interface LiveRoomCardProps {
  space: MockSpace;
  onPress: () => void;
}

export function LiveRoomCard({ space, onPress }: LiveRoomCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-[20px] overflow-hidden mb-4"
    >
      <LinearGradient
        colors={["#FF6DC1", "#C850C0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-[18px] min-h-[180px]"
      >
        {/* Header with badges */}
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center bg-white/25 px-2.5 py-1.5 rounded-xl gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-white text-[11px] font-bold">LIVE</Text>
          </View>
          {space.hasVideo && (
            <View className="bg-white/25 p-1.5 rounded-[10px]">
              <Video size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Content */}
        <View className="flex-1 justify-center my-3.5">
          <Text className="text-lg font-bold text-white mb-1.5" numberOfLines={2}>
            {space.title}
          </Text>
          <Text className="text-[13px] text-white/80 font-medium">
            {space.topic}
          </Text>
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image
              source={{ uri: space.host.avatar }}
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            {space.speakers.slice(0, 2).map((speaker, index) => (
              <Image
                key={speaker.id}
                source={{ uri: speaker.avatar }}
                className="w-7 h-7 rounded-full border-2 border-white -ml-2.5"
              />
            ))}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Users size={14} color="#fff" />
            <Text className="text-sm font-semibold text-white">
              {space.listeners.toLocaleString()}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
