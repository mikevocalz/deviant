import { View, Text, Pressable, RefreshControl } from "react-native";
import { LegendList } from "@/components/list";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui/avatar";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useCallback, useEffect, memo, useState, useRef, useMemo } from "react";
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
import { useActivityStore } from "@/lib/stores/activity-store";
import type { Activity } from "@/lib/hooks/use-activities-query";
import {
  useActivitiesQuery,
  getRouteForActivity,
} from "@/lib/hooks/use-activities-query";
import { useQueryClient } from "@tanstack/react-query";
import { activityKeys } from "@/lib/hooks/use-activities-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFollow } from "@/lib/hooks/use-follow";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import { screenPrefetch } from "@/lib/prefetch";
import { useBootstrapNotifications } from "@/lib/hooks/use-bootstrap-notifications";

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
    case "tag":
      return <UserPlus size={16} color="#FF5BFC" />;
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
      return activity.comment
        ? ` commented: "${activity.comment}"`
        : " commented on a post.";
    case "follow":
      return " started following you.";
    case "mention":
      return activity.comment
        ? ` mentioned you: "${activity.comment}"`
        : " mentioned you in a comment.";
    case "tag":
      return " tagged you in a post.";
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
  isFollowPending: boolean;
  onActivityPress: (activity: Activity) => void;
  onUserPress: (username: string, avatar?: string) => void;
  onPostPress: (postId: string) => void;
  onFollowBack: (username: string) => void;
}

const ActivityItem = memo(
  ({
    activity,
    isFollowed,
    isFollowPending,
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
        onPress={() =>
          onUserPress(activity.user.username, activity.user.avatar)
        }
        style={{ overflow: "visible", marginRight: 4 }}
      >
        <View style={{ overflow: "visible", width: 48, height: 48 }}>
          <Avatar
            uri={activity.user.avatar}
            username={activity.user.username}
            size={44}
            variant="roundedSquare"
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
            onPress={() =>
              onUserPress(activity.user.username, activity.user.avatar)
            }
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
          disabled={isFollowPending}
          className={`px-4 py-2 rounded-lg ml-3 ${
            isFollowed ? "bg-transparent border border-border" : "bg-primary"
          }`}
          style={isFollowPending ? { opacity: 0.5 } : undefined}
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
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.user?.id) || "";
  const trace = useScreenTrace("Activity");
  useBootstrapNotifications();

  // TanStack Query — MMKV-persisted, instant on cold start
  const {
    data: queryActivities,
    isLoading: queryLoading,
    refetch,
  } = useActivitiesQuery();

  // Store — follow state + mutations only (query is source of truth for activities)
  const { markActivityAsRead, markAllAsRead, subscribeToNotifications } =
    useActivityStore();

  // REACTIVE follow state — subscribe to followedUsers Set so component re-renders
  const followedUsers = useActivityStore((s) => s.followedUsers);
  const { mutate: followMutate, isPending: isFollowPending } = useFollow();
  const pendingFollowUser = useRef<string | null>(null);

  // Seed follow state from embedded viewerFollows in activity data
  // NO separate fetchFollowingState() call — eliminates trickle-in
  useEffect(() => {
    if (queryActivities && queryActivities.length > 0) {
      // Check if API data has explicit viewerFollows booleans (not undefined)
      const hasExplicitFollowState = queryActivities.some(
        (a) => typeof a.user?.viewerFollows === "boolean",
      );

      if (hasExplicitFollowState) {
        // API returned authoritative follow state — REBUILD the set (not merge)
        // This correctly handles unfollows too
        const authoritative = new Set<string>();
        for (const a of queryActivities) {
          if (a.user?.viewerFollows === true && a.user.username) {
            authoritative.add(a.user.username);
          }
        }
        useActivityStore.setState({ followedUsers: authoritative });
      } else {
        // Legacy cached data without viewerFollows — merge only additions
        const embedded = new Set<string>();
        for (const a of queryActivities) {
          if (a.user?.viewerFollows && a.user.username) {
            embedded.add(a.user.username);
          }
        }
        if (embedded.size > 0) {
          const current = useActivityStore.getState().followedUsers;
          const merged = new Set([...current, ...embedded]);
          useActivityStore.setState({ followedUsers: merged });
        }
      }
    }
  }, [queryActivities]);

  // RC-8: Query is the SINGLE source of truth — no Zustand mirror
  const activities: Activity[] = (queryActivities || []) as Activity[];

  const unreadCount = useMemo(
    () => activities.filter((a) => !a.isRead).length,
    [activities],
  );

  // Realtime subscription for instant notifications (follow, like, comment, etc.)
  useEffect(() => {
    const unsubscribe = subscribeToNotifications();
    return () => {
      unsubscribe?.();
    };
  }, [subscribeToNotifications]);

  // Soft refetch on tab focus — only if data is stale (> 60s old)
  // Replaces aggressive invalidateQueries which forced refetch on EVERY tab switch
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState(activityKeys.list(viewerId));
      const dataAge = state?.dataUpdatedAt
        ? Date.now() - state.dataUpdatedAt
        : Infinity;
      // Only refetch if data is older than 60s — prevents thrashing on quick tab switches
      if (dataAge > 60_000) {
        refetch();
      }
    }, [queryClient, viewerId, refetch]),
  );

  const filteredActivities = useMemo(
    () =>
      activities
        .filter((activity) => {
          // Hide comment/like/mention notifications for deleted posts
          if (
            (activity.type === "comment" ||
              activity.type === "like" ||
              activity.type === "mention" ||
              activity.type === "tag") &&
            activity.entityType === "post" &&
            !activity.post
          ) {
            return false;
          }
          return true;
        })
        .filter((activity) => {
          if (activeTab === "All") return true;
          if (activeTab === "Follows") return activity.type === "follow";
          if (activeTab === "Likes") return activity.type === "like";
          if (activeTab === "Comments") return activity.type === "comment";
          if (activeTab === "Mentions") return activity.type === "mention";
          return true;
        }),
    [activities, activeTab],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log("[Activity] Refreshing activities...");
    try {
      await refetch();
      console.log("[Activity] Refresh complete");
    } catch (error) {
      console.error("[Activity] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleUserPress = useCallback(
    (username: string, avatar?: string) => {
      console.log("[Activity] Navigating to profile:", username);
      screenPrefetch.profile(queryClient, username);
      router.push({
        pathname: `/(protected)/profile/${username}`,
        params: avatar ? { avatar } : {},
      } as any);
    },
    [router, queryClient],
  );

  const handlePostPress = useCallback(
    (postId: string) => {
      console.log("[Activity] Navigating to post:", postId);
      if (postId) {
        screenPrefetch.postDetail(queryClient, postId);
        router.push(`/(protected)/post/${postId}`);
      }
    },
    [router, queryClient],
  );

  const handleFollowBack = useCallback(
    (username: string) => {
      if (isFollowPending) return;
      console.log("[Activity] Following back:", username);
      // Find the user's integer ID from activities
      const activity = activities.find((a) => a.user.username === username);
      const targetUserId = activity?.user?.id;
      if (!targetUserId) {
        console.warn("[Activity] No userId found for", username);
        return;
      }
      const isCurrentlyFollowed = followedUsers.has(username);
      const action = isCurrentlyFollowed ? "unfollow" : "follow";
      pendingFollowUser.current = username;
      followMutate(
        { userId: targetUserId, action, username },
        {
          onSettled: () => {
            pendingFollowUser.current = null;
          },
        },
      );
    },
    [activities, followedUsers, followMutate, isFollowPending],
  );

  const handleActivityPress = useCallback(
    (activity: Activity) => {
      // Mark as read (persists to backend + patches query cache)
      markActivityAsRead(activity.id);
      // Also patch query cache for instant UI update
      queryClient.setQueryData(
        activityKeys.list(viewerId),
        (old: Activity[] | undefined) =>
          old?.map((a) => (a.id === activity.id ? { ...a, isRead: true } : a)),
      );

      // Use entityType/entityId-based routing for correct navigation
      const route = getRouteForActivity(activity);
      console.log("[Activity] Navigating to:", route, {
        type: activity.type,
        entityType: activity.entityType,
        entityId: activity.entityId,
      });
      router.push(route as any);
    },
    [markActivityAsRead, queryClient, viewerId, router],
  );

  // CRITICAL: All useCallback hooks MUST be before any early returns
  // to avoid "Rendered more hooks than during the previous render" error
  const renderItem = useCallback(
    ({ item: activity }: { item: Activity }) => {
      // PRIMARY: embedded viewerFollows from DTO data
      // FALLBACK: followedUsers Zustand store (for legacy/non-bootstrap path)
      const isFollowed =
        activity.user.viewerFollows ??
        followedUsers.has(activity.user.username);
      return (
        <ActivityItem
          activity={activity}
          isFollowed={isFollowed}
          isFollowPending={
            isFollowPending &&
            pendingFollowUser.current === activity.user.username
          }
          onActivityPress={handleActivityPress}
          onUserPress={handleUserPress}
          onPostPress={handlePostPress}
          onFollowBack={handleFollowBack}
        />
      );
    },
    [
      handleActivityPress,
      handleUserPress,
      handlePostPress,
      handleFollowBack,
      followedUsers,
      isFollowPending,
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

  // Skeleton ONLY when truly no data (first ever boot, no cache)
  // With MMKV persistence, cache-hit means zero skeleton on cold start
  if (queryLoading && activities.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <ActivitySkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <LegendList
        data={filteredActivities}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        recycleItems
        estimatedItemSize={80}
        refreshing={refreshing}
        onRefresh={onRefresh}
        extraData={{ followedUsers, isFollowPending }}
      />
    </View>
  );
}
