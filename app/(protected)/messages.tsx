import {
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Avatar } from "@/components/ui/avatar";
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
  Plus,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useState, useRef, useMemo } from "react";
import { MessagesSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { type Conversation } from "@/lib/api/messages";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useUnreadMessageCount,
  useFilteredConversations,
} from "@/lib/hooks/use-messages";
import { useQueryClient } from "@tanstack/react-query";
import { usePresenceStore } from "@/lib/stores/presence-store";
import { useUserPresence, formatLastSeen } from "@/lib/hooks/use-presence";
import PagerView from "react-native-pager-view";
import {
  useLynkHistoryStore,
  type LynkRecord,
} from "@/src/sneaky-lynk/stores/lynk-history-store";
import { LiveRoomCard } from "@/src/sneaky-lynk/ui/LiveRoomCard";
import { sneakyLynkApi } from "@/src/sneaky-lynk/api/supabase";
import { useFocusEffect } from "expo-router";
import { useUIStore } from "@/lib/stores/ui-store";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import { useBootstrapMessages } from "@/lib/hooks/use-bootstrap-messages";

interface ConversationItem {
  id: string;
  oderpantId: string;
  user: { username: string; name: string; avatar: string };
  lastMessage: string;
  timeAgo: string;
  unread: boolean;
}

function PresenceDot({ oderpantId }: { oderpantId: string }) {
  const { isOnline } = useUserPresence(oderpantId);
  if (!isOnline) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#22C55E",
        borderWidth: 2,
        borderColor: "#000",
      }}
    />
  );
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
  onChatPress: (id: string, item?: ConversationItem) => void;
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
              <Avatar
                uri={item.user.avatar}
                username={item.user.username}
                size={56}
                variant="roundedSquare"
              />
              <PresenceDot oderpantId={item.oderpantId} />
            </View>
          </Pressable>

          <TouchableOpacity
            onPress={() => onChatPress(item.id, item)}
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
              <Text
                className={`text-xs ${item.unread ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
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
  const localRooms = useLynkHistoryStore((s) => s.rooms);
  const endRoom = useLynkHistoryStore((s) => s.endRoom);
  const addRoom = useLynkHistoryStore((s) => s.addRoom);
  const [dbRooms, setDbRooms] = useState<LynkRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const liveRooms = await sneakyLynkApi.getLiveRooms();
      const mapped: LynkRecord[] = liveRooms.map((r) => ({
        id: r.id,
        title: r.title,
        topic: r.topic,
        description: r.description,
        isLive: r.isLive,
        hasVideo: r.hasVideo,
        isPublic: r.isPublic,
        status: r.status,
        host: r.host,
        speakers: r.speakers || [],
        listeners: r.listeners || 0,
        maxParticipants: r.maxParticipants || 50,
        createdAt: r.createdAt,
        endedAt: r.endedAt,
      }));
      setDbRooms(mapped);

      // Sync: mark local rooms as ended if they're not actually live in DB
      const actuallyLiveIds = new Set(
        liveRooms.filter((r) => r.isLive).map((r) => r.id),
      );
      for (const local of localRooms) {
        if (local.isLive && !actuallyLiveIds.has(local.id)) {
          endRoom(local.id);
        }
      }
    } catch (err) {
      console.error("[SneakyLynk] Failed to fetch live rooms:", err);
    }
  }, [localRooms, endRoom]);

  // Fetch live rooms on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await fetchRooms();
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchRooms]),
  );

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, [fetchRooms]);

  // Merge: DB rooms take priority, then local-only rooms
  // Only show rooms that are actually live (status open + participants > 0)
  const allRooms = useCallback(() => {
    const dbIds = new Set(dbRooms.map((r) => r.id));
    const localOnly = localRooms.filter((r) => !dbIds.has(r.id));
    return [...dbRooms, ...localOnly].filter((r) => r.isLive);
  }, [dbRooms, localRooms])();

  const handleCreateLynk = useCallback(() => {
    router.push("/(protected)/sneaky-lynk/create" as any);
  }, [router]);

  const showToast = useUIStore((s) => s.showToast);

  const handleRoomPress = useCallback(
    (room: LynkRecord) => {
      if (!room.isLive || room.status === "ended") {
        showToast(
          "info",
          "Lynk Ended",
          "This Lynk has ended and can't be rejoined",
        );
        return;
      }
      // Check capacity — toast if full
      const max = room.maxParticipants || 50;
      if (room.listeners >= max) {
        showToast(
          "error",
          "Room Full",
          "This Lynk is at max capacity. Pull to refresh when a slot opens.",
        );
        return;
      }
      router.push({
        pathname: "/(protected)/sneaky-lynk/room/[id]",
        params: {
          id: room.id,
          title: room.title,
          hasVideo: room.hasVideo ? "1" : "0",
        },
      } as any);
    },
    [router, showToast],
  );

  return (
    <View style={lynkStyles.container}>
      {/* Header */}
      <View style={lynkStyles.header}>
        <View style={lynkStyles.headerLeft}>
          <Radio size={28} color="#FC253A" />
          <Text style={lynkStyles.headerTitle}>Lynks</Text>
        </View>
        <TouchableOpacity
          style={lynkStyles.createButton}
          onPress={handleCreateLynk}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {allRooms.length > 0 ? (
        <ScrollView
          contentContainerStyle={lynkStyles.liveList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FC253A"
              colors={["#FC253A"]}
            />
          }
        >
          {allRooms.map((room) => (
            <LiveRoomCard
              key={room.id}
              space={room}
              onPress={() => handleRoomPress(room)}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={lynkStyles.emptyStateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FC253A"
              colors={["#FC253A"]}
            />
          }
        >
          <View style={lynkStyles.emptyState}>
            <Radio size={48} color="#6B7280" />
            <Text style={lynkStyles.emptyTitle}>No Lynks Yet</Text>
            <Text style={lynkStyles.emptyText}>
              Start a live conversation with friends
            </Text>
            <TouchableOpacity
              style={lynkStyles.createLynkButton}
              onPress={handleCreateLynk}
            >
              <Plus size={18} color="#fff" />
              <Text style={lynkStyles.createLynkText}>Start a Lynk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const lynkStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FC253A",
    alignItems: "center",
    justifyContent: "center",
  },
  liveList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  createLynkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FC253A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  createLynkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const trace = useScreenTrace("Messages");
  useBootstrapMessages();

  const { data: inboxUnreadCount = 0, spamCount: spamUnreadCount = 0 } =
    useUnreadMessageCount();

  // Soft refetch on focus — only if data is stale (> 30s old)
  // Replaces aggressive invalidateQueries which forced refetch on EVERY screen focus
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState([
        "messages",
        "filtered",
        "primary",
        currentUser?.id || "__no_user__",
      ]);
      const dataAge = state?.dataUpdatedAt
        ? Date.now() - state.dataUpdatedAt
        : Infinity;
      if (dataAge > 30_000) {
        queryClient.invalidateQueries({ queryKey: ["messages", "filtered"] });
      }
    }, [queryClient, currentUser?.id]),
  );

  // TanStack Query — renders from cache instantly (primed by boot prefetch)
  const {
    data: inboxRaw = [],
    isLoading: inboxLoading,
    isRefetching: inboxRefetching,
  } = useFilteredConversations("primary");
  const { data: spamRaw = [] } = useFilteredConversations("requests");

  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef<PagerView>(null);

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
          avatar: otherUser.avatar || "",
        },
        lastMessage: conv.lastMessage || "",
        timeAgo: conv.timestamp || "",
        unread: conv.unread || false,
      };
    },
    [currentUser?.username],
  );

  const inboxConversations = useMemo(
    () =>
      (inboxRaw as Conversation[])
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null),
    [inboxRaw, transformConversation],
  );

  const spamConversations = useMemo(
    () =>
      (spamRaw as Conversation[])
        .map(transformConversation)
        .filter((c): c is ConversationItem => c !== null),
    [spamRaw, transformConversation],
  );

  const isLoading = inboxLoading && inboxConversations.length === 0;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["messages", "filtered"] });
  }, [queryClient]);

  const handleChatPress = useCallback(
    (id: string, item?: ConversationItem) => {
      // Pass conversation data via params so chat header renders instantly
      // without waiting for async fetch — eliminates layout jump during transition
      if (item) {
        router.push({
          pathname: "/(protected)/chat/[id]",
          params: {
            id,
            peerAvatar: item.user.avatar || "",
            peerUsername: item.user.username || "",
            peerName: item.user.name || "",
          },
        });
      } else {
        router.push(`/(protected)/chat/${id}`);
      }
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
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      setActiveTab(e.nativeEvent.position);
    },
    [],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <MessagesSkeleton />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background max-w-3xl w-full self-center"
      style={{ paddingTop: insets.top }}
    >
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
            activeTab === 2 ? "border-b-2" : ""
          }`}
          style={activeTab === 2 ? { borderBottomColor: "#FC253A" } : undefined}
        >
          <Radio size={16} color={activeTab === 2 ? "#FC253A" : "#6B7280"} />
          <Text
            className={`font-semibold text-sm ${
              activeTab === 2 ? "" : "text-muted-foreground"
            }`}
            style={activeTab === 2 ? { color: "#FC253A" } : undefined}
          >
            Sneaky Lynk
          </Text>
        </Pressable>
      </View>

      {/* Swipeable Tab Content */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
        scrollEnabled={false}
      >
        <View key="inbox" style={{ flex: 1 }}>
          <ConversationList
            conversations={inboxConversations}
            isRefreshing={inboxRefetching}
            onRefresh={handleRefresh}
            onChatPress={handleChatPress}
            onProfilePress={handleProfilePress}
            emptyTitle="No Messages"
            emptyDescription="Messages from people you follow will appear here"
            emptyIcon={Inbox}
            router={router}
          />
        </View>
        <View key="requests" style={{ flex: 1 }}>
          <ConversationList
            conversations={spamConversations}
            isRefreshing={inboxRefetching}
            onRefresh={handleRefresh}
            onChatPress={handleChatPress}
            onProfilePress={handleProfilePress}
            emptyTitle="No Message Requests"
            emptyDescription="Messages from people you don't follow will appear here"
            emptyIcon={ShieldAlert}
            router={router}
          />
        </View>
        <View key="lynks" style={{ flex: 1 }}>
          <SneakyLynkContent router={router} />
        </View>
      </PagerView>
    </View>
  );
}
