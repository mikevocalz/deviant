import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native"
import { Main } from "@expo/html-elements"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { useState, useCallback, useEffect } from "react"
import { Heart, MessageCircle, UserPlus, AtSign } from "lucide-react-native"
import { Motion } from "@legendapp/motion"
import { ActivitySkeleton } from "@/components/skeletons"

interface Activity {
  id: string
  type: "like" | "comment" | "follow" | "mention"
  user: { 
    username: string
    avatar: string 
  }
  post?: { 
    id: string
    thumbnail: string 
  }
  comment?: string
  timeAgo: string
  isRead: boolean
}

const initialActivities: Activity[] = [
  {
    id: "1",
    type: "like",
    user: { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5" },
    post: { id: "f1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    timeAgo: "2h",
    isRead: false,
  },
  {
    id: "2",
    type: "comment",
    user: { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17" },
    post: { id: "f2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
    comment: "Amazing shot! 🔥",
    timeAgo: "4h",
    isRead: false,
  },
  {
    id: "3",
    type: "follow",
    user: { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14" },
    timeAgo: "1d",
    isRead: true,
  },
  {
    id: "4",
    type: "like",
    user: { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15" },
    post: { id: "f3", thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800" },
    timeAgo: "2d",
    isRead: true,
  },
  {
    id: "5",
    type: "mention",
    user: { username: "travel_with_me", avatar: "https://i.pravatar.cc/150?img=10" },
    post: { id: "f4", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800" },
    comment: "Check out @alex.creator's work!",
    timeAgo: "3d",
    isRead: true,
  },
  {
    id: "6",
    type: "comment",
    user: { username: "naturephoto", avatar: "https://i.pravatar.cc/150?img=13" },
    post: { id: "f1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    comment: "The colors are incredible!",
    timeAgo: "4d",
    isRead: true,
  },
  {
    id: "7",
    type: "follow",
    user: { username: "urban_explorer", avatar: "https://i.pravatar.cc/150?img=8" },
    timeAgo: "5d",
    isRead: true,
  },
  {
    id: "8",
    type: "like",
    user: { username: "foodie_adventures", avatar: "https://i.pravatar.cc/150?img=9" },
    post: { id: "f2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
    timeAgo: "1w",
    isRead: true,
  },
]

function ActivityIcon({ type, colors }: { type: Activity["type"]; colors: any }) {
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
}

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

export default function ActivityScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadActivities = async () => {
      setIsLoading(true)
      await new Promise(resolve => setTimeout(resolve, 800))
      setActivities(initialActivities)
      setIsLoading(false)
    }
    loadActivities()
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    console.log("[Activity] Refreshing activities...")
    setTimeout(() => {
      setActivities(prev => prev.map(a => ({ ...a, isRead: true })))
      setRefreshing(false)
      console.log("[Activity] Refresh complete")
    }, 1000)
  }, [])

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
    setFollowedUsers(prev => {
      const next = new Set(prev)
      if (next.has(username)) {
        next.delete(username)
      } else {
        next.add(username)
      }
      return next
    })
  }, [])

  const handleActivityPress = useCallback((activity: Activity) => {
    setActivities(prev => 
      prev.map(a => a.id === activity.id ? { ...a, isRead: true } : a)
    )
    
    if (activity.post) {
      handlePostPress(activity.post.id)
    } else {
      handleUserPress(activity.user.username)
    }
  }, [handlePostPress, handleUserPress])

  const unreadCount = activities.filter(a => !a.isRead).length

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Main className="flex-1">
          <ActivitySkeleton />
        </Main>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="border-b border-border px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-foreground">Activity</Text>
            {unreadCount > 0 && (
              <View className="bg-accent rounded-full px-2 py-0.5 min-w-[20px] items-center">
                <Text className="text-white text-xs font-semibold">{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {activities.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-muted-foreground">No activity yet</Text>
            </View>
          ) : (
            activities.map((activity) => (
              <Motion.View
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
              >
                <Pressable 
                  onPress={() => handleActivityPress(activity)}
                  className={`flex-row items-center px-4 py-3 border-b border-border ${
                    !activity.isRead ? "bg-primary/10" : ""
                  }`}
                >
                  <Pressable onPress={() => handleUserPress(activity.user.username)}>
                    <View className="relative">
                      <Image 
                        source={{ uri: activity.user.avatar }} 
                        className="w-11 h-11 rounded-full"
                      />
                      <View className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-1 border-2 border-background">
                        <ActivityIcon type={activity.type} colors={colors} />
                      </View>
                    </View>
                  </Pressable>

                  <View className="flex-1 ml-3">
                    <Text className="text-sm text-foreground" numberOfLines={2}>
                      <Text 
                        className="font-semibold text-foreground"
                        onPress={() => handleUserPress(activity.user.username)}
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
                    <Pressable onPress={() => handlePostPress(activity.post!.id)}>
                      <Image 
                        source={{ uri: activity.post.thumbnail }} 
                        className="w-12 h-12 rounded-lg ml-3"
                      />
                    </Pressable>
                  )}

                  {activity.type === "follow" && (
                    <Pressable 
                      onPress={() => handleFollowBack(activity.user.username)}
                      className={`px-4 py-2 rounded-lg ml-3 ${
                        followedUsers.has(activity.user.username) 
                          ? "bg-transparent border border-border" 
                          : "bg-primary"
                      }`}
                    >
                      <Text className={`text-[13px] font-semibold ${
                        followedUsers.has(activity.user.username) 
                          ? "text-muted-foreground" 
                          : "text-white"
                      }`}>
                        {followedUsers.has(activity.user.username) ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                  )}
                </Pressable>
              </Motion.View>
            ))
          )}
        </ScrollView>
      </Main>
    </View>
  )
}
