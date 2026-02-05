/**
 * Message Requests Screen
 * Shows conversations from non-followed users
 */

import {
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShieldAlert } from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { MessagesSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { EmptyState } from "@/components/ui/empty-state";
import { messagesApiClient, type Conversation } from "@/lib/api/messages";

interface ConversationItem {
  id: string;
  user: { username: string; name: string; avatar: string };
  lastMessage: string;
  timeAgo: string;
  unread: boolean;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export default function MessageRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.messages;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const transformConversation = useCallback(
    (conv: Conversation): ConversationItem | null => {
      const otherUser = conv.user;
      if (!otherUser) return null;

      return {
        id: conv.id,
        user: {
          username: otherUser.username,
          name: otherUser.name || otherUser.username,
          avatar:
            otherUser.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.username)}&background=3EA4E5&color=fff`,
        },
        lastMessage: conv.lastMessage || "",
        timeAgo: formatTimeAgo(conv.timestamp),
        unread: conv.unread || false,
      };
    },
    []
  );

  const loadConversations = useCallback(async () => {
    try {
      const requestConvs = await messagesApiClient.getFilteredConversations("requests");
      const transformed = requestConvs
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null);
      setConversations(transformed);
    } catch (error) {
      console.error("[Requests] Error loading conversations:", error);
    } finally {
      setScreenLoading("messages", false);
      setIsRefreshing(false);
    }
  }, [transformConversation, setScreenLoading]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const handleChatPress = useCallback(
    (id: string) => {
      router.push(`/(protected)/chat/${id}`);
    },
    [router]
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      router.push(`/(protected)/profile/${username}`);
    },
    [router]
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
      {/* Header */}
      <View className="border-b border-border px-4 py-3">
        <Text className="text-lg font-bold text-foreground text-center">Message Requests</Text>
        <Text className="text-xs text-muted-foreground text-center mt-1">
          Messages from people you don't follow
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3EA4E5"
          />
        }
      >
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
                  <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground" />
                )}
              </View>
            </Pressable>

            <TouchableOpacity
              onPress={() => handleChatPress(item.id)}
              activeOpacity={0.7}
              className="flex-1"
            >
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => handleProfilePress(item.user.username)}>
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
            icon={ShieldAlert}
            title="No Message Requests"
            description="Messages from people you don't follow will appear here"
          />
        )}
      </ScrollView>
    </View>
  );
}
