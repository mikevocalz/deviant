/**
 * Listener Grid Component
 * Grid of listeners (non-speakers) in the room
 */

import { View, Text } from "react-native";
import { Image } from "expo-image";
import type { SneakyUser } from "../types";

interface Listener {
  id: string;
  user: SneakyUser;
}

interface ListenerGridProps {
  listeners: Listener[];
}

export function ListenerGrid({ listeners }: ListenerGridProps) {
  if (listeners.length === 0) return null;

  return (
    <View className="px-5 mb-6">
      <Text className="text-base font-bold text-foreground mb-4">
        Listeners ({listeners.length})
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {listeners.map((listener) => (
          <View key={listener.id} className="items-center w-14">
            <Image
              source={{ uri: listener.user.avatar }}
              className="w-12 h-12 rounded-2xl mb-1.5"
            />
            <Text
              className="text-[11px] text-muted-foreground text-center"
              numberOfLines={1}
            >
              {listener.user.displayName.split(" ")[0]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
