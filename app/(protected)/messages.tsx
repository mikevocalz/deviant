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
import {
  ArrowLeft,
  Edit,
  MessageSquare,
  Inbox,
  ShieldAlert,
} from "lucide-react-native";
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
  oderpantId: string;
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

// Shared conversation list component
function ConversationList({
  conversations,
  isRefreshing,
  onRefresh,
  onChatPress,
  onProfilePress,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  router,
}: {
  conversations: ConversationItem[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onChatPress: (id: string) => void;
  onProfilePress: (username: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: typeof MessageSquare;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#3EA4E5"
        />
      }
    >
      {conversations.map((item) => (
        <View
          key={item.id}
          className="flex-row items-center gap-3 border-b border-border px-4 py-3"
        >
          <Pressable onPress={() => onProfilePress(item.user.username)}>
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
            onPress={() => onChatPress(item.id)}
            activeOpacity={0.7}
            className="flex-1"
          >
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => onProfilePress(item.user.username)}>
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
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button onPress={() => router.push("/(protected)/messages/new")}>
              Start a Conversation
            </Button>
          }
        />
      )}
    </ScrollView>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.messages;
  const currentUser = useAuthStore((s) => s.user);

  // Separate state for Inbox and Spam
  const [inboxConversations, setInboxConversations] = useState<
    ConversationItem[]
  >([]);
  const [spamConversations, setSpamConversations] = useState<
    ConversationItem[]
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Transform backend conversation to UI format
  const transformConversation = useCallback(
    (conv: Conversation): ConversationItem | null => {
      // Find the other participant (not current user)
      const otherUser = conv.participants.find(
        (p) => p.username !== currentUser?.username,
      );

      if (!otherUser) return null;

      return {
        id: conv.id,
        oderpantId: otherUser.id,
        user: {
          username: otherUser.username,
          name: otherUser.name || otherUser.username,
          avatar:
            otherUser.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.username)}&background=3EA4E5&color=fff`,
        },
        lastMessage: "",
        timeAgo: formatTimeAgo(conv.lastMessageAt),
        unread: false,
      };
    },
    [currentUser?.username],
  );

  // Load conversations filtered by follow status
  const loadConversations = useCallback(async () => {
    try {
      console.log("[Messages] Loading filtered conversations...");

      // Fetch Inbox (followed users) and Spam (non-followed users) in parallel
      const [inboxConvs, spamConvs] = await Promise.all([
        messagesApiClient.getFilteredConversations("inbox"),
        messagesApiClient.getFilteredConversations("spam"),
      ]);

      console.log("[Messages] Loaded:", {
        inbox: inboxConvs.length,
        spam: spamConvs.length,
      });

      const transformedInbox = inboxConvs
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null);

      const transformedSpam = spamConvs
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null);

      setInboxConversations(transformedInbox);
      setSpamConversations(transformedSpam);
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

  const handleTabPress = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

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

      {/* Tab Bar */}
      <View className="flex-row border-b border-border">
        <Pressable
          onPress={() => handleTabPress(0)}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 ${
            activeTab === 0 ? "border-b-2 border-primary" : ""
          }`}
        >
          <Inbox size={18} color={activeTab === 0 ? "#3EA4E5" : "#6B7280"} />
          <Text
            className={`font-semibold ${
              activeTab === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Inbox
          </Text>
          {inboxConversations.length > 0 && (
            <View className="bg-primary rounded-full px-2 py-0.5 min-w-[20px] items-center">
              <Text className="text-xs text-white font-bold">
                {inboxConversations.length}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleTabPress(1)}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 ${
            activeTab === 1 ? "border-b-2 border-primary" : ""
          }`}
        >
          <ShieldAlert
            size={18}
            color={activeTab === 1 ? "#3EA4E5" : "#6B7280"}
          />
          <Text
            className={`font-semibold ${
              activeTab === 1 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Requests
          </Text>
          {spamConversations.length > 0 && (
            <View className="bg-muted-foreground rounded-full px-2 py-0.5 min-w-[20px] items-center">
              <Text className="text-xs text-white font-bold">
                {spamConversations.length}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Tab Content - Conditional rendering */}
      {activeTab === 0 ? (
        <ConversationList
          conversations={inboxConversations}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onChatPress={handleChatPress}
          onProfilePress={handleProfilePress}
          emptyTitle="No Messages"
          emptyDescription="Messages from people you follow will appear here"
          emptyIcon={Inbox}
          router={router}
        />
      ) : (
        <ConversationList
          conversations={spamConversations}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onChatPress={handleChatPress}
          onProfilePress={handleProfilePress}
          emptyTitle="No Message Requests"
          emptyDescription="Messages from people you don't follow will appear here"
          emptyIcon={ShieldAlert}
          router={router}
        />
      )}
    </View>
  );
}
