import { View, Text, ScrollView, Pressable, Dimensions, StyleSheet } from "react-native"
import { Image } from "expo-image"
import { Settings, Grid, Bookmark, Play, User, Camera, Link, ChevronRight } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { useMemo, useState, useEffect } from "react"
import { useBookmarkStore } from "@/lib/stores/bookmark-store"
import { useProfileStore } from "@/lib/stores/profile-store"
import { posts } from "@/lib/constants"
import { ProfileSkeleton } from "@/components/skeletons"
import Animated, { FadeInUp } from "react-native-reanimated"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

const { width } = Dimensions.get("window")
const columnWidth = (width - 6) / 3

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
  const bookmarkedPosts = useBookmarkStore((state) => state.bookmarkedPosts)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
      setIsLoading(false)
    }
    loadProfile()
  }, [])

  const savedPosts = useMemo(() => {
    return posts
      .filter((post) => bookmarkedPosts.includes(post.id))
      .map((post) => ({
        id: post.id,
        thumbnail: post.media[0]?.url || "/placeholder.svg",
        type: post.media[0]?.type === "video" ? "video" : "image",
      }))
  }, [bookmarkedPosts])

  const displayPosts = activeTab === "posts" ? userPosts : savedPosts

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ProfileSkeleton />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View style={styles.headerSpacer} />
        <Text className="text-lg font-semibold text-foreground">{userProfile.username}</Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
          <Settings size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <Image 
              source={{ uri: userProfile.avatar }} 
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.statsContainer}>
              <Pressable style={styles.statItem}>
                <Text className="text-xl font-bold text-foreground">{userProfile.postsCount}</Text>
                <Text className="text-xs text-muted-foreground">Posts</Text>
              </Pressable>
              <Pressable style={styles.statItem}>
                <Text className="text-xl font-bold text-foreground">{(userProfile.followersCount / 1000).toFixed(1)}K</Text>
                <Text className="text-xs text-muted-foreground">Followers</Text>
              </Pressable>
              <Pressable style={styles.statItem}>
                <Text className="text-xl font-bold text-foreground">{userProfile.followingCount}</Text>
                <Text className="text-xs text-muted-foreground">Following</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.bioSection}>
            <Text className="text-base font-semibold text-foreground">{userProfile.fullName}</Text>
            <Text className="mt-1.5 text-sm leading-5 text-foreground/90">{userProfile.bio}</Text>
            {userProfile.website && (
              <Text className="mt-1.5 text-sm font-medium text-primary">{userProfile.website}</Text>
            )}
          </View>

          <View style={styles.actionsRow}>
            <Popover>
              <PopoverTrigger>
                <View style={styles.editButton} className="bg-secondary">
                  <Text className="font-semibold text-secondary-foreground">Edit profile</Text>
                </View>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={4}>
                <Pressable
                  onPress={() => router.push("/(protected)/profile/edit" as any)}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <User size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">Edit Profile</Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
                <View className="mx-4 h-px bg-white/10" />
                <Pressable
                  onPress={() => console.log("Change avatar")}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <Camera size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">Change Avatar</Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
                <View className="mx-4 h-px bg-white/10" />
                <Pressable
                  onPress={() => console.log("Edit links")}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <Link size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">Edit Links</Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
              </PopoverContent>
            </Popover>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer} className="border-t border-border">
          <Pressable
            onPress={() => setActiveTab("posts")}
            style={[
              styles.tabItem,
              activeTab === "posts" && styles.tabItemActive,
            ]}
          >
            <Grid size={22} color={activeTab === "posts" ? colors.foreground : colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("saved")}
            style={[
              styles.tabItem,
              activeTab === "saved" && styles.tabItemActive,
            ]}
          >
            <Bookmark size={22} color={activeTab === "saved" ? colors.foreground : colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Grid */}
        <View style={styles.gridContainer}>
          {displayPosts.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInUp.delay(index * 50).duration(400).springify()}
              style={[styles.gridItem, { width: columnWidth, height: columnWidth }]}
            >
              <Pressable
                onPress={() => router.push(`/post/${item.id}`)}
                style={styles.gridItemPressable}
              >
                <Image
                  source={{ uri: item.thumbnail }}
                  style={styles.gridImage}
                  contentFit="cover"
                />
                {item.type === "video" && (
                  <View style={styles.videoIndicator}>
                    <Play size={18} color="#fff" fill="#fff" />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {displayPosts.length === 0 && (
          <View style={styles.emptyState}>
            <Bookmark size={48} color={colors.mutedForeground} />
            <Text className="mt-4 text-base text-muted-foreground">
              {activeTab === "saved" ? "No saved posts yet" : "No posts yet"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  statsContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  bioSection: {
    marginTop: 16,
  },
  actionsRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabsContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "transparent",
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: "#fff",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    padding: 1,
  },
  gridItemPressable: {
    flex: 1,
    borderRadius: 2,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  videoIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
})
