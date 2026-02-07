import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Grid,
  MoreHorizontal,
  Share2,
  Play,
  Grid3x3,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { shareProfile } from "@/lib/utils/sharing";
import { SharedImage } from "@/components/shared-image";
import { Motion } from "@legendapp/motion";
import { ErrorBoundary } from "@/components/error-boundary";

import { useCallback, memo, useState, useMemo, useEffect } from "react";
import { useUser, useFollow } from "@/lib/hooks";
import { useProfilePosts } from "@/lib/hooks/use-posts";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { messagesApiClient } from "@/lib/api/messages";
import { useUIStore } from "@/lib/stores/ui-store";
import { Avatar, AvatarSizes } from "@/components/ui/avatar";

const { width } = Dimensions.get("window");
const columnWidth = (width - 8) / 3;

interface MockUser {
  id?: string;
  username: string;
  fullName: string;
  name?: string;
  avatar: string;
  bio: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

const mockUsers: Record<string, MockUser> = {
  emma_wilson: {
    id: "mock-emma",
    username: "emma_wilson",
    fullName: "Emma Wilson",
    name: "Emma Wilson",
    avatar: "https://i.pravatar.cc/150?img=5",
    bio: "Travel enthusiast 🌍\nPhotography lover 📸",
    postsCount: 234,
    followersCount: 12500,
    followingCount: 456,
  },
  john_fitness: {
    id: "mock-john",
    username: "john_fitness",
    fullName: "John Fitness",
    name: "John Fitness",
    avatar: "https://i.pravatar.cc/150?img=17",
    bio: "Fitness coach 💪\nHelping you reach your goals",
    postsCount: 189,
    followersCount: 45000,
    followingCount: 234,
  },
  sarah_artist: {
    id: "mock-sarah",
    username: "sarah_artist",
    fullName: "Sarah Artist",
    name: "Sarah Artist",
    avatar: "https://i.pravatar.cc/150?img=14",
    bio: "Digital artist 🎨\nCommissions open",
    postsCount: 567,
    followersCount: 8900,
    followingCount: 123,
  },
  naturephoto: {
    id: "mock-nature",
    username: "naturephoto",
    fullName: "Nature Photography",
    name: "Nature Photography",
    avatar: "https://i.pravatar.cc/150?img=13",
    bio: "Capturing the beauty of our planet 🌿\nSony Ambassador | DM for prints",
    postsCount: 892,
    followersCount: 156000,
    followingCount: 312,
  },
  urban_explorer: {
    id: "mock-urban",
    username: "urban_explorer",
    fullName: "Urban Explorer",
    name: "Urban Explorer",
    avatar: "https://i.pravatar.cc/150?img=8",
    bio: "Street photography | City vibes 🏙️\nBased in Tokyo & NYC",
    postsCount: 445,
    followersCount: 67800,
    followingCount: 189,
  },
  foodie_adventures: {
    id: "mock-foodie",
    username: "foodie_adventures",
    fullName: "Foodie Adventures",
    name: "Foodie Adventures",
    avatar: "https://i.pravatar.cc/150?img=9",
    bio: "Eating my way around the world 🍜\nMichelin hunter | Food blogger",
    postsCount: 678,
    followersCount: 89400,
    followingCount: 445,
  },
  travel_with_me: {
    id: "mock-travel",
    username: "travel_with_me",
    fullName: "Sarah Anderson",
    name: "Sarah Anderson",
    avatar: "https://i.pravatar.cc/150?img=10",
    bio: "Full-time traveler ✈️\n50+ countries | Content creator",
    postsCount: 1234,
    followersCount: 234000,
    followingCount: 567,
  },
  coffee_culture: {
    id: "mock-coffee",
    username: "coffee_culture",
    fullName: "Marcus Chen",
    name: "Marcus Chen",
    avatar: "https://i.pravatar.cc/150?img=31",
    bio: "Coffee enthusiast ☕\nBarista | Roaster | Educator",
    postsCount: 312,
    followersCount: 28900,
    followingCount: 234,
  },
  street_style: {
    id: "mock-street",
    username: "street_style",
    fullName: "Olivia Park",
    name: "Olivia Park",
    avatar: "https://i.pravatar.cc/150?img=33",
    bio: "Fashion designer 👗\nSeoul | Paris | NYC\nShop link below ⬇️",
    postsCount: 567,
    followersCount: 445000,
    followingCount: 178,
  },
  astro_captures: {
    id: "mock-astro",
    username: "astro_captures",
    fullName: "David Starr",
    name: "David Starr",
    avatar: "https://i.pravatar.cc/150?img=35",
    bio: "Astrophotographer 🌌\nChasing the cosmos one photo at a time",
    postsCount: 234,
    followersCount: 178000,
    followingCount: 89,
  },
  pet_paradise: {
    id: "mock-pet",
    username: "pet_paradise",
    fullName: "Luna & Max",
    name: "Luna & Max",
    avatar: "https://i.pravatar.cc/150?img=37",
    bio: "Two rescue pups living their best life 🐕\nAdopt don't shop!",
    postsCount: 445,
    followersCount: 123000,
    followingCount: 567,
  },
  minimalist_home: {
    id: "mock-minimalist",
    username: "minimalist_home",
    fullName: "Interior Studio",
    name: "Interior Studio",
    avatar: "https://i.pravatar.cc/150?img=40",
    bio: "Interior design studio 🏠\nScandinavian inspired | Less is more",
    postsCount: 289,
    followersCount: 67800,
    followingCount: 156,
  },
};

const mockPosts = [
  {
    id: "1",
    thumbnail:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
  },
  {
    id: "2",
    thumbnail:
      "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800",
  },
  {
    id: "3",
    thumbnail:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
  },
  {
    id: "4",
    thumbnail:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800",
  },
  {
    id: "5",
    thumbnail:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
  },
  {
    id: "6",
    thumbnail:
      "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800",
  },
  {
    id: "f1",
    thumbnail:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
  },
  {
    id: "f2",
    thumbnail:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
  },
  {
    id: "f3",
    thumbnail:
      "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800",
  },
  {
    id: "f4",
    thumbnail:
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800",
  },
  {
    id: "f5",
    thumbnail:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
  },
  {
    id: "f6",
    thumbnail:
      "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800",
  },
  {
    id: "f7",
    thumbnail:
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800",
  },
  {
    id: "f8",
    thumbnail:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
  },
  {
    id: "f9",
    thumbnail:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
  },
];

function UserProfileScreenComponent() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // DEFENSIVE: Ensure username is a valid string
  const safeUsername =
    typeof username === "string" && username.length > 0 ? username : null;

  const isOwnProfile = currentUser?.username === safeUsername;

  // Fetch user data
  const {
    data: userData,
    isLoading,
    isError,
    error,
  } = useUser(safeUsername || "");

  // Fetch user posts
  const { data: userPosts = [], isLoading: isLoadingPosts } = useProfilePosts(
    safeUsername || "",
  );

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const { mutate: followMutate, isPending: isFollowPending } = useFollow();

  // Get userId for follow queries
  const userId = (userData as any)?.id;

  // CRITICAL: Redirect to tabs profile if viewing own profile
  // This ensures consistent UI/UX when navigating from comments to own profile
  useEffect(() => {
    const isFollowingValue = (userData as any)?.isFollowing;
    if (typeof isFollowingValue === "boolean") {
      setIsFollowing(isFollowingValue);
    }
  }, [(userData as any)?.isFollowing]);

  // Use API data or fallback to mock data - cast to any for flexibility with API response
  const rawUser: {
    id?: string;
    username: string;
    fullName?: string;
    name?: string;
    avatar?: string;
    bio?: string;
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
  } = (userData as any) ||
    mockUsers[username || ""] || {
      id: undefined,
      username: username || "unknown",
      fullName: "Unknown User",
      name: "Unknown User",
      avatar: "https://i.pravatar.cc/150?img=1",
      bio: "",
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    };

  // CRITICAL: For own profile, prefer auth store avatar (optimistically updated)
  // over the useUser cache which may be stale after an avatar change
  const user =
    isOwnProfile && currentUser?.avatar
      ? { ...rawUser, avatar: currentUser.avatar }
      : rawUser;

  // Create a followMutation-like object for compatibility
  const followMutation = {
    isPending: isFollowPending,
    mutate: followMutate,
  };

  const handlePostPress = useCallback(
    (postId: string) => {
      if (postId) {
        router.push(`/(protected)/post/${postId}`);
      }
    },
    [router],
  );

  const handleFollowPress = useCallback(() => {
    if (!user.id || !username) return;

    const action = isFollowing ? "unfollow" : "follow";
    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState); // Optimistic update

    followMutate(
      { userId: user.id, action, username }, // Pass username for optimistic cache update
      {
        onError: () => {
          setIsFollowing(isFollowing); // Revert on error
        },
      },
    );
  }, [user.id, username, isFollowing, followMutate]);

  // State for message button loading
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const handleMessagePress = useCallback(async () => {
    if (!user.id || isCreatingConversation) return;

    setIsCreatingConversation(true);
    try {
      console.log(
        "[Profile] Creating/getting conversation with user:",
        user.id,
      );
      const conversationId = await messagesApiClient.getOrCreateConversation(
        user.id,
      );

      if (conversationId) {
        console.log("[Profile] Navigating to chat:", conversationId);
        router.push(`/(protected)/chat/${conversationId}`);
      } else {
        console.error(
          "[Profile] Failed to create conversation - no ID returned",
        );
        showToast("error", "Error", "Could not start conversation");
      }
    } catch (error: any) {
      console.error("[Profile] Message error:", error);
      showToast(
        "error",
        "Error",
        error?.message || "Failed to start conversation",
      );
    } finally {
      setIsCreatingConversation(false);
    }
  }, [user.id, router, isCreatingConversation, showToast]);

  // DEFENSIVE: Early return for missing username - show safe error state
  if (!safeUsername) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">User not found</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-primary">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // DEFENSIVE: Show error state if API failed (but don't crash)
  if (isError && !userData) {
    console.error("[Profile] API error:", error);
    // Continue rendering with fallback data instead of crashing
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">
          {isLoading ? "Loading..." : user.username || "Profile"}
        </Text>
        <Pressable>
          <MoreHorizontal size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info - Centered */}
        <View className="p-4">
          <View className="items-center">
            <View className="flex-row items-center justify-center gap-8 mb-6">
              <Avatar
                uri={user.avatar}
                username={user.username}
                size="xl"
                variant="roundedSquare"
              />
              <View className="flex-row gap-8">
                <View className="items-center">
                  <Text className="text-lg font-bold text-foreground">
                    {user.postsCount || 0}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Posts</Text>
                </View>
                <Pressable
                  className="items-center"
                  onPress={() => {
                    if (userId) {
                      router.push(
                        `/(protected)/profile/followers?userId=${userId}&username=${user.username}`,
                      );
                    }
                  }}
                >
                  <Text className="text-lg font-bold text-foreground">
                    {(user.followersCount ?? 0) >= 1000
                      ? `${((user.followersCount ?? 0) / 1000).toFixed(1)}K`
                      : (user.followersCount ?? 0)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Followers
                  </Text>
                </Pressable>
                <Pressable
                  className="items-center"
                  onPress={() => {
                    if (userId) {
                      router.push(
                        `/(protected)/profile/following?userId=${userId}&username=${user.username}`,
                      );
                    }
                  }}
                >
                  <Text className="text-lg font-bold text-foreground">
                    {user.followingCount || 0}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Following
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <Text className="font-semibold text-foreground">
              {user.name || user.fullName || user.username}
            </Text>
            {user.bio && (
              <Text className="mt-1 text-sm text-foreground/90">
                {user.bio}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View className="mt-4 flex-row gap-2">
            {isOwnProfile ? (
              <>
                <Pressable
                  onPress={() =>
                    router.push("/(protected)/edit-profile" as any)
                  }
                  style={{ flex: 1 }}
                >
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={styles.secondaryButton}
                  >
                    <Text className="font-semibold text-secondary-foreground">
                      Edit Profile
                    </Text>
                  </Motion.View>
                </Pressable>
                <Pressable
                  onPress={() =>
                    shareProfile(user.username, user.fullName || user.name)
                  }
                  style={styles.shareButton}
                >
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
                <Pressable
                  onPress={handleFollowPress}
                  disabled={followMutation.isPending || !user.id}
                  style={{ flex: 1 }}
                >
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={[
                      styles.primaryButton,
                      isFollowing && styles.secondaryButton,
                      (followMutation.isPending || !user.id) && {
                        opacity: 0.5,
                      },
                    ]}
                  >
                    <Text
                      className={`font-semibold ${isFollowing ? "text-secondary-foreground" : "text-primary-foreground"}`}
                    >
                      {followMutation.isPending
                        ? isFollowing
                          ? "Unfollowing..."
                          : "Following..."
                        : isFollowing
                          ? "Following"
                          : "Follow"}
                    </Text>
                  </Motion.View>
                </Pressable>
                <Pressable
                  onPress={handleMessagePress}
                  disabled={isCreatingConversation || !user.id}
                  style={{ flex: 1 }}
                >
                  <Motion.View
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                    style={[
                      styles.secondaryButton,
                      (isCreatingConversation || !user.id) && { opacity: 0.5 },
                    ]}
                  >
                    <Text className="font-semibold text-secondary-foreground">
                      {isCreatingConversation ? "Opening..." : "Message"}
                    </Text>
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
        {isLoading || isLoadingPosts ? (
          <View className="p-4 items-center">
            <Text className="text-muted-foreground">Loading...</Text>
          </View>
        ) : userPosts.length === 0 ? (
          <View className="p-4 items-center flex-1">
            <Text className="text-muted-foreground">No posts yet</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap">
            {userPosts.map((post) => (
              <Pressable
                key={post.id}
                onPress={() => router.push(`/(protected)/post/${post.id}`)}
                style={{ width: columnWidth, height: columnWidth, padding: 1 }}
              >
                {post.thumbnail ? (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                    }}
                  >
                    <Image
                      source={{ uri: post.thumbnail }}
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#1a1a1a",
                      }}
                      contentFit="cover"
                    />
                    {/* Video indicator */}
                    {post.type === "video" && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: "rgba(0,0,0,0.6)",
                          borderRadius: 12,
                          padding: 6,
                        }}
                      >
                        <Play size={16} color="#fff" fill="#fff" />
                      </View>
                    )}
                    {/* Carousel indicator */}
                    {post.hasMultipleImages && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: "rgba(0,0,0,0.6)",
                          borderRadius: 12,
                          padding: 6,
                        }}
                      >
                        <Grid3x3 size={16} color="#fff" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#1a1a1a",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text className="text-muted-foreground text-xs">
                      No image
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
});

// Wrap with ErrorBoundary for crash protection
function UserProfileScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="Profile"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
    >
      <UserProfileScreenComponent />
    </ErrorBoundary>
  );
}

export default memo(UserProfileScreen);
