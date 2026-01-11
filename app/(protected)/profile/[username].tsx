import { View, Text, ScrollView, Pressable, Dimensions, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { ArrowLeft, Grid, MoreHorizontal, Share2 } from "lucide-react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { useAuthStore } from "@/lib/stores/auth-store"
import { shareProfile } from "@/lib/utils/sharing"
import { SharedImage } from "@/components/shared-image"
import { Motion } from "@legendapp/motion"

import { useCallback, memo } from "react"

const { width } = Dimensions.get("window")
const columnWidth = (width - 8) / 3

const mockUsers: Record<string, { username: string; fullName: string; avatar: string; bio: string; postsCount: number; followersCount: number; followingCount: number }> = {
  emma_wilson: {
    username: "emma_wilson",
    fullName: "Emma Wilson",
    avatar: "https://i.pravatar.cc/150?img=5",
    bio: "Travel enthusiast 🌍\nPhotography lover 📸",
    postsCount: 234,
    followersCount: 12500,
    followingCount: 456,
  },
  john_fitness: {
    username: "john_fitness",
    fullName: "John Fitness",
    avatar: "https://i.pravatar.cc/150?img=17",
    bio: "Fitness coach 💪\nHelping you reach your goals",
    postsCount: 189,
    followersCount: 45000,
    followingCount: 234,
  },
  sarah_artist: {
    username: "sarah_artist",
    fullName: "Sarah Artist",
    avatar: "https://i.pravatar.cc/150?img=14",
    bio: "Digital artist 🎨\nCommissions open",
    postsCount: 567,
    followersCount: 8900,
    followingCount: 123,
  },
}

const mockPosts = [
  { id: "1", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
  { id: "2", thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
  { id: "3", thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800" },
  { id: "4", thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800" },
  { id: "5", thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800" },
  { id: "6", thumbnail: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800" },
]

function UserProfileScreenComponent() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const router = useRouter()
  const { colors } = useColorScheme()
  const currentUser = useAuthStore((state) => state.user)
  
  const isOwnProfile = currentUser?.username === username

  const user = mockUsers[username || ""] || {
    username: username || "unknown",
    fullName: "Unknown User",
    avatar: "https://i.pravatar.cc/150?img=1",
    bio: "",
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  }

  const handlePostPress = useCallback((postId: string) => {
    router.push(`/(protected)/post/${postId}`)
  }, [router])

  const handleFollowPress = useCallback(() => {
    // Haptic feedback
  }, [])

  const handleMessagePress = useCallback(() => {
    // Haptic feedback
  }, [])

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold">{user.username}</Text>
        <Pressable>
          <MoreHorizontal size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View className="p-4">
          <View className="flex-row items-center gap-6">
            <SharedImage 
              source={{ uri: user.avatar }} 
              style={styles.avatar}
              sharedTag={`profile-avatar-${user.username}`}
            />
            <View className="flex-1 flex-row justify-around">
              <View className="items-center">
                <Text className="text-lg font-bold">{user.postsCount}</Text>
                <Text className="text-xs text-muted-foreground">Posts</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold">{(user.followersCount / 1000).toFixed(1)}K</Text>
                <Text className="text-xs text-muted-foreground">Followers</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold">{user.followingCount}</Text>
                <Text className="text-xs text-muted-foreground">Following</Text>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-semibold">{user.fullName}</Text>
            <Text className="mt-1 text-sm text-foreground/90">{user.bio}</Text>
          </View>

          {/* Action Buttons */}
          <View className="mt-4 flex-row gap-2">
            {isOwnProfile ? (
              <>
                <Pressable onPress={() => router.push("/(protected)/profile/edit" as any)} style={{ flex: 1 }}>
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={styles.secondaryButton}
                  >
                    <Text className="font-semibold text-secondary-foreground">Edit Profile</Text>
                  </Motion.View>
                </Pressable>
                <Pressable onPress={() => shareProfile(user.username, user.fullName)} style={styles.shareButton}>
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                  >
                    <Share2 size={20} color="#fff" />
                  </Motion.View>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleFollowPress} style={{ flex: 1 }}>
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={styles.primaryButton}
                  >
                    <Text className="font-semibold text-primary-foreground">Follow</Text>
                  </Motion.View>
                </Pressable>
                <Pressable onPress={handleMessagePress} style={{ flex: 1 }}>
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={styles.secondaryButton}
                  >
                    <Text className="font-semibold text-secondary-foreground">Message</Text>
                  </Motion.View>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        <View className="flex-row border-b border-border">
          <Pressable className="flex-1 items-center border-b-2 border-foreground py-3">
            <Grid size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Posts Grid */}
        <View className="flex-row flex-wrap">
          {mockPosts.map((post) => (
            <Pressable
              key={post.id}
              onPress={() => handlePostPress(post.id)}
              style={{ width: columnWidth, height: columnWidth }}
            >
              <Motion.View
                whileTap={{ scale: 0.95, opacity: 0.8 }}
                transition={{ type: "spring", damping: 15, stiffness: 400 }}
                style={styles.postContainer}
              >
                <SharedImage 
                  source={{ uri: post.thumbnail }} 
                  style={styles.postImage} 
                  contentFit="cover"
                  sharedTag={`post-image-${post.id}`}
                />
              </Motion.View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#3EA4E5",
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  postContainer: {
    flex: 1,
    margin: 2,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
})

export default memo(UserProfileScreenComponent)
