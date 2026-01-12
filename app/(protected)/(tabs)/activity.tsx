import { View, Text, Pressable, RefreshControl } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { useCallback, useEffect, memo } from "react"
import { Heart, MessageCircle, UserPlus, AtSign } from "lucide-react-native"
import { ActivitySkeleton } from "@/components/skeletons"
import { useActivityStore, type Activity } from "@/lib/stores/activity-store"
import { useUIStore } from "@/lib/stores/ui-store"

const ActivityIcon = memo(({ type }: { type: Activity["type"] }) => {
  switch (type) {
    case "like":
      return <Heart size={16} color="#FF5BFC" fill="#FF5BFC" />
    case "comment":
      return <MessageCircle size={16} color="#3EA4E5" />
    case "follow":
      return <UserPlus size={16} color="#8A40CF" />
    case "mention":
      return <AtSign size={16} color="#34A2DF" />
    default:
      return null
  }
})

function getActivityText(activity: Activity): string {
  switch (activity.type) {
    case "like":
      return " liked your post."
    case "comment":
      return ` commented: "${activity.comment}"`
    case "follow":
      return " started following you."
    case "mention":
      return ` mentioned you: "${activity.comment}"`
    default:
      return ""
  }
}

interface ActivityItemProps {
  activity: Activity
  isFollowed: boolean
  onActivityPress: (activity: Activity) => void
  onUserPress: (username: string) => void
  onPostPress: (postId: string) => void
  onFollowBack: (username: string) => void
}

const ActivityItem = memo(({ 
  activity, 
  isFollowed,
  onActivityPress, 
  onUserPress, 
  onPostPress, 
  onFollowBack 
}: ActivityItemProps) => (
  <Pressable
    onPress={() => onActivityPress(activity)}
    className={`flex-row items-center pl-6 pr-4 py-3 border-b border-border ${
      !activity.isRead ? "bg-primary/10" : ""
    }`}
  >
    <Pressable onPress={() => onUserPress(activity.user.username)}>
      <View className="relative">
        <Image
          source={{ uri: activity.user.avatar }}
          className="w-11 h-11 rounded-full"
        />
        <View className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-1 border-2 border-background">
          <ActivityIcon type={activity.type} />
        </View>
      </View>
    </Pressable>

    <View className="flex-1 ml-3 overflow-hidden">
      <Text
        className="text-sm text-foreground"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
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
          isFollowed
            ? "bg-transparent border border-border"
            : "bg-primary"
        }`}
      >
        <Text
          className={`text-[13px] font-semibold ${
            isFollowed
              ? "text-muted-foreground"
              : "text-white"
          }`}
        >
          {isFollowed ? "Following" : "Follow"}
        </Text>
      </Pressable>
    )}
  </Pressable>
))

export default function ActivityScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const {
    activities,
    refreshing,
    setRefreshing,
    toggleFollowUser,
    isUserFollowed,
    markActivityAsRead,
    markAllAsRead,
    loadInitialActivities,
    getUnreadCount,
  } = useActivityStore()
  const { loadingScreens, setScreenLoading } = useUIStore()
  const isLoading = loadingScreens.activity

  useEffect(() => {
    const loadActivities = async () => {
      await new Promise(resolve => setTimeout(resolve, 800))
      loadInitialActivities()
      setScreenLoading("activity", false)
    }
    loadActivities()
  }, [loadInitialActivities, setScreenLoading])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    console.log("[Activity] Refreshing activities...")
    setTimeout(() => {
      markAllAsRead()
      setRefreshing(false)
      console.log("[Activity] Refresh complete")
    }, 1000)
  }, [setRefreshing, markAllAsRead])

  const handleUserPress = useCallback((username: string) => {
    console.log("[Activity] Navigating to profile:", username)
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  const handlePostPress = useCallback((postId: string) => {
    console.log("[Activity] Navigating to post:", postId)
    router.push(`/(protected)/post/${postId}`)
  }, [router])

  const handleFollowBack = useCallback((username: string) => {
    console.log("[Activity] Following back:", username)
    toggleFollowUser(username)
  }, [toggleFollowUser])

  const handleActivityPress = useCallback((activity: Activity) => {
    markActivityAsRead(activity.id)
    
    if (activity.post) {
      handlePostPress(activity.post.id)
    } else {
      handleUserPress(activity.user.username)
    }
  }, [handlePostPress, handleUserPress, markActivityAsRead])

  const unreadCount = getUnreadCount()

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ActivitySkeleton />
      </View>
    );
  }

  const renderItem = useCallback(({ item: activity }: { item: Activity }) => (
    <ActivityItem
      activity={activity}
      isFollowed={isUserFollowed(activity.user.username)}
      onActivityPress={handleActivityPress}
      onUserPress={handleUserPress}
      onPostPress={handlePostPress}
      onFollowBack={handleFollowBack}
    />
  ), [handleActivityPress, handleUserPress, handlePostPress, handleFollowBack, isUserFollowed]);

  const ListHeader = useCallback(() => (
    <View className="border-b border-border pl-6 pr-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">Activity</Text>
        {unreadCount > 0 && (
          <View className="bg-accent rounded-full px-2 py-0.5 min-w-[20px] items-center">
            <Text className="text-white text-xs font-semibold">{unreadCount}</Text>
          </View>
        )}
      </View>
    </View>
  ), [unreadCount])

  const ListEmpty = useCallback(() => (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-muted-foreground">No activity yet</Text>
    </View>
  ), [])

  const keyExtractor = useCallback((item: Activity) => item.id, [])

  return (
    <FlashList
      data={activities}
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
  )
}
