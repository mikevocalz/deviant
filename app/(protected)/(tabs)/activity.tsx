import { View, Text, Pressable, RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useCallback, useEffect, memo, useState, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  Calendar,
} from "lucide-react-native";
import { ActivitySkeleton } from "@/components/skeletons";
import { useActivityStore, type Activity } from "@/lib/stores/activity-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS = ["All", "Follows", "Likes", "Comments", "Mentions"] as const;
type TabType = (typeof TABS)[number];

const ActivityIcon = memo(({ type }: { type: Activity["type"] }) => {
  switch (type) {
    case "like":
      return <Heart size={16} color="#FF5BFC" fill="#FF5BFC" />;
    case "comment":
      return <MessageCircle size={16} color="#3EA4E5" />;
    case "follow":
      return <UserPlus size={16} color="#8A40CF" />;
    case "mention":
      return <AtSign size={16} color="#34A2DF" />;
    case "event_invite":
    case "event_update":
      return <Calendar size={16} color="#10B981" />;
    default:
      return null;
  }
});

function getActivityText(activity: Activity): string {
  switch (activity.type) {
    case "like":
      return " liked your post.";
    case "comment":
      return ` commented: "${activity.comment}"`;
    case "follow":
      return " started following you.";
    case "mention":
      return ` mentioned you: "${activity.comment}"`;
    case "event_invite":
      return ` invited you to ${activity.event?.title || "an event"}.`;
    case "event_update":
      return ` updated ${activity.event?.title || "an event"}.`;
    default:
      return "";
  }
}

interface ActivityItemProps {
  activity: Activity;
  isFollowed: boolean;
  onActivityPress: (activity: Activity) => void;
  onUserPress: (username: string) => void;
  onPostPress: (postId: string) => void;
  onFollowBack: (username: string) => void;
}

const ActivityItem = memo(
  ({
    activity,
    isFollowed,
    onActivityPress,
    onUserPress,
    onPostPress,
    onFollowBack,
  }: ActivityItemProps) => (
    <Pressable
      onPress={() => onActivityPress(activity)}
      className={`flex-row items-center py-4 border-b border-border ${
        !activity.isRead ? "bg-primary/10" : ""
      }`}
      style={{ paddingLeft: 16, paddingRight: 16 }}
    >
      <Pressable
        onPress={() => onUserPress(activity.user.username)}
        style={{ overflow: "visible", marginRight: 4 }}
      >
        <View style={{ overflow: "visible", width: 48, height: 48 }}>
          <Image
            source={{ uri: activity.user.avatar }}
            style={{ width: 44, height: 44, borderRadius: 22 }}
          />
          <View
            className="absolute bg-card rounded-full p-1 border-2 border-background"
            style={{ bottom: 0, right: 0 }}
          >
            <ActivityIcon type={activity.type} />
          </View>
        </View>
      </Pressable>

      <View className="flex-1 ml-3">
        <Text className="text-sm text-foreground" numberOfLines={2}>
          <Text
            className="font-semibold text-foreground"
            onPress={() => onUserPress(activity.user.username)}
          >
            {activity.user.username}
          </Text>
          {getActivityText(activity)}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {activity.timeAgo}
        </Text>
      </View>

      {activity.post && (
        <Pressable onPress={() => onPostPress(activity.post!.id)}>
          <Image
            source={{ uri: activity.post.thumbnail }}
            className="w-12 h-12 rounded-lg ml-3"
          />
        </Pressable>
      )}

      {activity.type === "follow" && (
        <Pressable
          onPress={() => onFollowBack(activity.user.username)}
          className={`px-4 py-2 rounded-lg ml-3 ${
            isFollowed ? "bg-transparent border border-border" : "bg-primary"
          }`}
        >
          <Text
            className={`text-[13px] font-semibold ${
              isFollowed ? "text-muted-foreground" : "text-white"
            }`}
          >
            {isFollowed ? "Following" : "Follow"}
          </Text>
        </Pressable>
      )}
    </Pressable>
  ),
);

export default function ActivityScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("All");
  const {
    activities,
    refreshing,
    setRefreshing,
    toggleFollowUser,
    isUserFollowed,
    markActivityAsRead,
    markAllAsRead,
    loadInitialActivities,
    fetchFromBackend,
    getUnreadCount,
    getRouteForActivity,
  } = useActivityStore();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.activity;
  const unreadCount = getUnreadCount();

  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const loadActivities = async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      loadInitialActivities();
      setScreenLoading("activity", false);
      hasLoadedOnce.current = true;
    };
    loadActivities();
  }, [loadInitialActivities, setScreenLoading]);

  // Refetch when tab is focused (ensures new follow notifications appear)
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) {
        fetchFromBackend();
      }
    }, [fetchFromBackend]),
  );

  const filteredActivities = activities.filter((activity) => {
    if (activeTab === "All") return true;
    if (activeTab === "Follows") return activity.type === "follow";
    if (activeTab === "Likes") return activity.type === "like";
    if (activeTab === "Comments") return activity.type === "comment";
    if (activeTab === "Mentions") return activity.type === "mention";
    return true;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log("[Activity] Refreshing activities from backend...");
    try {
      await fetchFromBackend();
      console.log("[Activity] Refresh complete");
    } catch (error) {
      console.error("[Activity] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing, fetchFromBackend]);

  const handleUserPress = useCallback(
    (username: string) => {
      console.log("[Activity] Navigating to profile:", username);
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  const handlePostPress = useCallback(
    (postId: string) => {
      console.log("[Activity] Navigating to post:", postId);
      if (postId) {
        router.push(`/(protected)/post/${postId}`);
      }
    },
    [router],
  );

  const handleFollowBack = useCallback(
    (username: string) => {
      console.log("[Activity] Following back:", username);
      toggleFollowUser(username);
    },
    [toggleFollowUser],
  );

  const handleActivityPress = useCallback(
    (activity: Activity) => {
      // Mark as read (persists to backend)
      markActivityAsRead(activity.id);

      // Use entityType/entityId-based routing for correct navigation
      const route = getRouteForActivity(activity);
      console.log("[Activity] Navigating to:", route, {
        type: activity.type,
        entityType: activity.entityType,
        entityId: activity.entityId,
      });
      router.push(route as any);
    },
    [markActivityAsRead, getRouteForActivity, router],
  );

  // CRITICAL: All useCallback hooks MUST be before any early returns
  // to avoid "Rendered more hooks than during the previous render" error
  const renderItem = useCallback(
    ({ item: activity }: { item: Activity }) => (
      <ActivityItem
        activity={activity}
        isFollowed={isUserFollowed(activity.user.username)}
        onActivityPress={handleActivityPress}
        onUserPress={handleUserPress}
        onPostPress={handlePostPress}
        onFollowBack={handleFollowBack}
      />
    ),
    [
      handleActivityPress,
      handleUserPress,
      handlePostPress,
      handleFollowBack,
      isUserFollowed,
    ],
  );

  const ListHeader = useCallback(
    () => (
      <View className="px-4 py-3">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Bell size={24} color={colors.foreground} />
            <Text className="text-2xl font-bold text-foreground ml-2">
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View className="ml-2 bg-primary px-2 py-0.5 rounded-full">
                <Text className="text-xs font-semibold text-white">
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={markAllAsRead}
              className="flex-row items-center px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <CheckCheck size={14} color={colors.primary} />
              <Text className="text-xs font-medium text-primary ml-1">
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View
          className="flex-row justify-around items-center px-1 py-2 rounded-lg"
          style={{
            backgroundColor: "rgba(28, 28, 28, 0.6)",
            borderColor: "rgba(68, 68, 68, 0.8)",
            borderWidth: 1,
            minHeight: 44,
          }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 items-center justify-center py-1.5 rounded-md"
              style={
                activeTab === tab
                  ? { backgroundColor: "rgba(255,255,255,0.1)" }
                  : {}
              }
            >
              <Text
                style={{
                  color: activeTab === tab ? "#f5f5f4" : "#a3a3a3",
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [activeTab, unreadCount, colors, markAllAsRead],
  );

  const ListEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center py-20">
        <BellOff size={48} color={colors.mutedForeground} />
        <Text className="text-lg font-semibold text-foreground mt-4">
          No notifications yet
        </Text>
        <Text className="text-sm text-muted-foreground mt-1 text-center px-8">
          When someone likes, comments, or follows you, you'll see it here
        </Text>
      </View>
    ),
    [colors],
  );

  const keyExtractor = useCallback((item: Activity) => item.id, []);

  // Early return for loading state AFTER all hooks
  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ActivitySkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlashList
        data={filteredActivities}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}
