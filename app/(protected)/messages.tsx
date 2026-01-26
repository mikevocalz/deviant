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
import { ArrowLeft, Edit, MessageSquare } from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { MessagesSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { messagesApiClient, type Conversation } from "@/lib/api/messages";
import { useAuthStore } from "@/lib/stores/auth-store";

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

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.messages;
  const currentUser = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Transform backend conversation to UI format
  const transformConversation = useCallback((conv: Conversation): ConversationItem | null => {
    // Find the other participant (not current user)
    const otherUser = conv.participants.find(
      (p) => p.username !== currentUser?.username
    );
    
    if (!otherUser) return null;

    return {
      id: conv.id,
      user: {
        username: otherUser.username,
        name: otherUser.name || otherUser.username,
        avatar: otherUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.username)}&background=3EA4E5&color=fff`,
      },
      lastMessage: "", // Would need to fetch last message separately
      timeAgo: formatTimeAgo(conv.lastMessageAt),
      unread: false, // Would need to track read status
    };
  }, [currentUser?.username]);

  // Load conversations from backend
  const loadConversations = useCallback(async () => {
    try {
      console.log("[Messages] Loading conversations...");
      const backendConvs = await messagesApiClient.getConversations();
      console.log("[Messages] Loaded", backendConvs.length, "conversations");
      
      const transformed = backendConvs
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null);
      
      setConversations(transformed);
    } catch (error) {
      console.error("[Messages] Error loading conversations:", error);
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
