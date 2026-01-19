import {
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Edit, MessageSquare } from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect } from "react";
import { MessagesSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

// TODO: Replace with real conversations from backend
const conversations: Array<{
  id: string;
  user: { username: string; name: string; avatar: string };
  lastMessage: string;
  timeAgo: string;
  unread: boolean;
}> = [];

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.messages;

  useEffect(() => {
    const loadMessages = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setScreenLoading("messages", false);
    };
    loadMessages();
  }, [setScreenLoading]);

  const handleChatPress = useCallback(
    (id: string) => {
      router.push(`/(protected)/chat/${id}`);
    },
    [router],
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <MessagesSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">Messages</Text>
        <Pressable
          onPress={() => router.push("/(protected)/messages/new")}
          hitSlop={12}
        >
          <Edit size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {conversations.map((item) => (
          <View
            key={item.id}
            className="flex-row items-center gap-3 border-b border-border px-4 py-3"
          >
            <Pressable onPress={() => handleProfilePress(item.user.username)}>
              <View className="relative">
                <Image
                  source={{ uri: item.user.avatar }}
                  className="h-14 w-14 rounded-full"
                />
                {item.unread && (
                  <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
                )}
              </View>
            </Pressable>

            <TouchableOpacity
              onPress={() => handleChatPress(item.id)}
              activeOpacity={0.7}
              className="flex-1"
            >
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => handleProfilePress(item.user.username)}
                >
                  <Text
                    className={`text-base text-foreground ${item.unread ? "font-bold" : "font-medium"}`}
                  >
                    {item.user.username}
                  </Text>
                </Pressable>
                <Text className="text-xs text-muted-foreground">
                  {item.timeAgo}
                </Text>
              </View>
              <Text
                className={`text-sm mt-0.5 ${item.unread ? "text-foreground" : "text-muted-foreground"}`}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {conversations.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No Messages"
            description="When you message someone, your conversations will appear here"
            action={
              <Button onPress={() => router.push("/(protected)/messages/new")}>
                Start a Conversation
              </Button>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
