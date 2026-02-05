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
  Users,
  Radio,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { MessagesSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { messagesApiClient, type Conversation } from "@/lib/api/messages";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUnreadMessageCount } from "@/lib/hooks/use-messages";
import { mockSpaces, TOPICS, type Topic } from "@/src/sneaky-lynk/mocks/data";
import { TopicPills, LiveRoomCard } from "@/src/sneaky-lynk/ui";

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
            <Button
              onPress={() => router.push("/(protected)/messages/new" as any)}
            >
              Start a Conversation
            </Button>
          }
        />
      )}
    </ScrollView>
  );
}

// Sneaky Lynk tab content
function SneakyLynkContent({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const [selectedTopic, setSelectedTopic] = useState<Topic>("All");

  const filteredSpaces =
    selectedTopic === "All"
      ? mockSpaces
      : mockSpaces.filter((space) => space.topic === selectedTopic);

  const handleRoomPress = useCallback(
    (roomId: string) => {
      router.push(`/(protected)/sneaky-lynk/room/${roomId}` as any);
    },
    [router],
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <TopicPills
        selectedTopic={selectedTopic}
        onSelectTopic={setSelectedTopic}
      />

      <View className="px-4 pb-6">
        {filteredSpaces.map((space) => (
          <LiveRoomCard
            key={space.id}
            space={space}
            onPress={() => handleRoomPress(space.id)}
          />
        ))}

        {filteredSpaces.length === 0 && (
          <View className="items-center justify-center py-12">
            <Radio size={48} color="#6B7280" />
            <Text className="text-muted-foreground text-center mt-4">
              No live rooms in {selectedTopic}
            </Text>
            <Text className="text-muted-foreground/60 text-center text-sm mt-1">
              Check back later or start your own!
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.messages;
  const currentUser = useAuthStore((s) => s.user);

  const { data: inboxUnreadCount = 0, spamCount: spamUnreadCount = 0 } =
    useUnreadMessageCount();

  const [inboxConversations, setInboxConversations] = useState<
    ConversationItem[]
  >([]);
  const [spamConversations, setSpamConversations] = useState<
    ConversationItem[]
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const transformConversation = useCallback(
    (conv: Conversation): ConversationItem | null => {
      const otherUser = conv.user;
      if (!otherUser) return null;

      return {
        id: conv.id,
        oderpantId: conv.id,
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
    [currentUser?.username],
  );

  const loadConversations = useCallback(async () => {
    try {
      console.log("[Messages] Loading filtered conversations...");

      const [inboxConvs, spamConvs] = await Promise.all([
        messagesApiClient.getFilteredConversations("primary"),
        messagesApiClient.getFilteredConversations("requests"),
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
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() =>
              router.push("/(protected)/messages/new-group" as any)
            }
            hitSlop={12}
          >
            <Users size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(protected)/messages/new" as any)}
            hitSlop={12}
          >
            <Edit size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Tab Bar - 3 tabs */}
      <View className="flex-row border-b border-border">
        {/* Inbox Tab */}
        <Pressable
          onPress={() => handleTabPress(0)}
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${
            activeTab === 0 ? "border-b-2 border-primary" : ""
          }`}
        >
          <Inbox size={16} color={activeTab === 0 ? "#3EA4E5" : "#6B7280"} />
          <Text
            className={`font-semibold text-sm ${
              activeTab === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Inbox
          </Text>
          {inboxUnreadCount > 0 && (
            <View className="bg-primary rounded-full px-1.5 py-0.5 min-w-[18px] items-center">
              <Text className="text-[10px] text-white font-bold">
                {inboxUnreadCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Requests Tab */}
        <Pressable
          onPress={() => handleTabPress(1)}
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${
            activeTab === 1 ? "border-b-2 border-primary" : ""
          }`}
        >
          <ShieldAlert
            size={16}
            color={activeTab === 1 ? "#3EA4E5" : "#6B7280"}
          />
          <Text
            className={`font-semibold text-sm ${
              activeTab === 1 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Requests
          </Text>
          {spamUnreadCount > 0 && (
            <View className="bg-muted-foreground rounded-full px-1.5 py-0.5 min-w-[18px] items-center">
              <Text className="text-[10px] text-white font-bold">
                {spamUnreadCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Sneaky Lynk Tab */}
        <Pressable
          onPress={() => handleTabPress(2)}
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${
            activeTab === 2 ? "border-b-2 border-primary" : ""
          }`}
        >
          <Radio size={16} color={activeTab === 2 ? "#3EA4E5" : "#6B7280"} />
          <Text
            className={`font-semibold text-sm ${
              activeTab === 2 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Sneaky Lynk
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      {activeTab === 0 && (
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
      )}
      {activeTab === 1 && (
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
      {activeTab === 2 && <SneakyLynkContent router={router} />}
    </View>
  );
}
