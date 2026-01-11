import { View, Text, ScrollView, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { Main } from "@expo/html-elements"
import { Settings, Grid, Bookmark, Play } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { useMemo, useState, useEffect } from "react"
import { useBookmarkStore } from "@/lib/stores/bookmark-store"
import { useProfileStore } from "@/lib/stores/profile-store"
import { posts } from "@/lib/constants"
import { ProfileSkeleton } from "@/components/skeletons"
import Animated, { FadeInUp } from "react-native-reanimated"

const { width } = Dimensions.get("window")
const columnWidth = (width - 8) / 3

const userProfile = {
  username: "alex.creator",
  fullName: "Alex Thompson",
  avatar: "https://i.pravatar.cc/150?img=12",
  bio: "Digital creator & photographer\nCapturing moments that matter\nAvailable for collabs",
  website: "https://alexthompson.com",
  postsCount: 142,
  followersCount: 24800,
  followingCount: 892,
}

const userPosts = [
  { id: "1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", type: "image" },
  { id: "2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800", type: "image" },
  { id: "3", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800", type: "video" },
  { id: "4", thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800", type: "image" },
  { id: "p5", thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800", type: "image" },
  { id: "p6", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800", type: "image" },
]

export default function ProfileScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { activeTab, setActiveTab } = useProfileStore()
  const getBookmarkedPostIds = useBookmarkStore((state) => state.getBookmarkedPostIds)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
      setIsLoading(false)
    }
    loadProfile()
  }, [])

  const savedPosts = useMemo(() => {
    const bookmarkedIds = getBookmarkedPostIds()
    return posts
      .filter((post) => bookmarkedIds.includes(post.id))
      .map((post) => ({
        id: post.id,
        thumbnail: post.media[0]?.url || "/placeholder.svg",
        type: post.media[0]?.type === "video" ? "video" : "image",
      }))
  }, [getBookmarkedPostIds])

  const displayPosts = activeTab === "posts" ? userPosts : savedPosts

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Main className="flex-1">
          <ProfileSkeleton />
        </Main>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="w-10" />
          <Text className="text-lg font-semibold">{userProfile.username}</Text>
          <Pressable onPress={() => router.push("/settings")}>
            <Settings size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Profile Info */}
          <View className="p-4">
            <View className="flex-row items-center gap-6">
              <Image source={{ uri: userProfile.avatar }} className="h-20 w-20 rounded-full" />
              <View className="flex-1 flex-row justify-around">
                <View className="items-center">
                  <Text className="text-lg font-bold">{userProfile.postsCount}</Text>
                  <Text className="text-xs text-muted-foreground">Posts</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold">{(userProfile.followersCount / 1000).toFixed(1)}K</Text>
                  <Text className="text-xs text-muted-foreground">Followers</Text>
                </View>
                <View className="items-center">
                  <Text className="text-lg font-bold">{userProfile.followingCount}</Text>
                  <Text className="text-xs text-muted-foreground">Following</Text>
                </View>
              </View>
            </View>

            <View className="mt-4">
              <Text className="font-semibold">{userProfile.fullName}</Text>
              <Text className="mt-1 text-sm text-foreground/90">{userProfile.bio}</Text>
              {userProfile.website && (
                <Text className="mt-1 text-sm font-medium text-primary">{userProfile.website}</Text>
              )}
            </View>

            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => router.push("/(protected)/profile/edit" as any)} className="flex-1 items-center rounded-lg bg-secondary py-2">
                <Text className="font-semibold">Edit profile</Text>
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View className="flex-row border-t border-border">
            <Pressable
              onPress={() => setActiveTab("posts")}
              className={`flex-1 flex-row items-center justify-center gap-2 border-t-2 py-3 ${
                activeTab === "posts" ? "border-foreground" : "border-transparent"
              }`}
            >
              <Grid size={16} color={activeTab === "posts" ? colors.foreground : colors.mutedForeground} />
              <Text
                className={`text-xs font-semibold uppercase ${activeTab === "posts" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Posts
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("saved")}
              className={`flex-1 flex-row items-center justify-center gap-2 border-t-2 py-3 ${
                activeTab === "saved" ? "border-foreground" : "border-transparent"
              }`}
            >
              <Bookmark size={16} color={activeTab === "saved" ? colors.foreground : colors.mutedForeground} />
              <Text
                className={`text-xs font-semibold uppercase ${activeTab === "saved" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Saved
              </Text>
            </Pressable>
          </View>

          {/* Grid */}
          <View className="flex-row flex-wrap">
            {displayPosts.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeInUp.delay(index * 80).duration(600).springify()}
                style={{ width: columnWidth, height: columnWidth }}
              >
                <Pressable
                  onPress={() => router.push(`/post/${item.id}`)}
                  style={{ flex: 1 }}
                >
                  <View className="relative m-0.5 flex-1 overflow-hidden rounded-lg bg-card">
                    <Image
                      source={{ uri: item.thumbnail }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    {item.type === "video" && (
                      <View className="absolute right-2 top-2">
                        <Play size={20} color="#fff" fill="#fff" />
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </Main>
    </View>
  )
}
