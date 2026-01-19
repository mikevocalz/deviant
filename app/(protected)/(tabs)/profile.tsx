
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";
import {
  Settings,
  Album,
  Film,
  Bookmark,
  Tag,
  Play,
  User,
  Camera,
  Link,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useMemo, useEffect } from "react";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { posts } from "@/lib/constants";
import { ProfileSkeleton } from "@/components/skeletons";
import { Motion } from "@legendapp/motion";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

const { width } = Dimensions.get("window");
const columnWidth = (width - 6) / 3;

// TODO: Replace with real user posts from API
const userPosts: { id: string; thumbnail: string; type: string }[] = [];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { activeTab, setActiveTab } = useProfileStore();
  const bookmarkedPosts = useBookmarkStore((state) => state.bookmarkedPosts);
  const { loadingScreens, setScreenLoading } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const isLoading = loadingScreens.profile;

  // Format follower count (e.g., 24800 -> "24.8K")
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  useEffect(() => {
    const loadProfile = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setScreenLoading("profile", false);
    };
    loadProfile();
  }, [setScreenLoading]);

  const savedPosts = useMemo(() => {
    return posts
      .filter((post) => bookmarkedPosts.includes(post.id))
      .map((post) => ({
        id: post.id,
        thumbnail: post.media[0]?.url || "/placeholder.svg",
        type: post.media[0]?.type === "video" ? "video" : "image",
      }));
  }, [bookmarkedPosts]);

  const videoPosts = useMemo(
    () => userPosts.filter((p) => p.type === "video"),
    [],
  );
  const taggedPosts: typeof userPosts = []; // Placeholder for tagged posts

  const displayPosts = useMemo(() => {
    switch (activeTab) {
      case "posts":
        return userPosts;
      case "video":
        return videoPosts;
      case "saved":
        return savedPosts;
      case "tagged":
        return taggedPosts;
      default:
        return userPosts;
    }
  }, [activeTab, savedPosts, videoPosts]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <ProfileSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="w-10" />
        <Text className="text-lg font-semibold text-foreground">
          {user?.username || "Profile"}
        </Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
          <Settings size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-5"
      >
        <View className="px-5 pt-5 pb-4">
          <View className="flex-row items-center gap-6">
            <Image
              source={{
                uri:
                  user?.avatar ||
                  "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(user?.name || "User"),
              }}
              className="w-[88px] h-[88px] rounded-full"
              contentFit="cover"
            />
            <View className="flex-1 flex-row justify-around">
              <Pressable className="items-center px-2">
                <Text className="text-xl font-bold text-foreground">
                  {user?.postsCount || 0}
                </Text>
                <Text className="text-xs text-muted-foreground">Posts</Text>
              </Pressable>
              <Pressable className="items-center px-2">
                <Text className="text-xl font-bold text-foreground">
                  {formatCount(user?.followersCount || 0)}
                </Text>
                <Text className="text-xs text-muted-foreground">Followers</Text>
              </Pressable>
              <Pressable className="items-center px-2">
                <Text className="text-xl font-bold text-foreground">
                  {formatCount(user?.followingCount || 0)}
                </Text>
                <Text className="text-xs text-muted-foreground">Following</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-base font-semibold text-foreground">
              {user?.name || "User"}
            </Text>
            {user?.bio && (
              <Text className="mt-1.5 text-sm leading-5 text-foreground/90">
                {user.bio}
              </Text>
            )}
            {user?.website && (
              <Text className="mt-1.5 text-sm font-medium text-primary">
                {user.website}
              </Text>
            )}
          </View>

          <View className="mt-5 flex-row gap-2">
            <Popover>
              <PopoverTrigger>
                <View className="flex-1 items-center justify-center py-2.5 rounded-[10px] bg-secondary">
                  <Text className="font-semibold text-secondary-foreground">
                    Edit profile
                  </Text>
                </View>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start">
                <Pressable
                  onPress={() =>
                    router.push("/(protected)/profile/edit" as any)
                  }
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <User size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">
                    Edit Profile
                  </Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
                <View className="mx-4 h-px bg-white/10" />
                <Pressable
                  onPress={() => console.log("Change avatar")}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <Camera size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">
                    Change Avatar
                  </Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
                <View className="mx-4 h-px bg-white/10" />
                <Pressable
                  onPress={() => console.log("Edit links")}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <Link size={20} color={colors.foreground} />
                  <Text className="flex-1 text-base text-foreground">
                    Edit Links
                  </Text>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
              </PopoverContent>
            </Popover>
          </View>
        </View>

        {/* Tabs */}
        <View
          className="flex-row justify-around items-center my-4 mx-4 px-1 py-2 rounded-lg"
          style={{
            backgroundColor: "rgba(28, 28, 28, 0.6)",
            borderColor: "rgba(68, 68, 68, 0.8)",
            borderWidth: 1,
            minHeight: 44,
          }}
        >
          <Pressable
            onPress={() => setActiveTab("posts")}
            className="flex-row items-center justify-center gap-1 flex-1"
          >
            <Album
              size={14}
              color={activeTab === "posts" ? "#f5f5f4" : "#737373"}
            />
            <Text
              style={{
                color: activeTab === "posts" ? "#f5f5f4" : "#a3a3a3",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Posts
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("video")}
            className="flex-row items-center justify-center gap-1 flex-1"
          >
            <Film
              size={14}
              color={activeTab === "video" ? "#f5f5f4" : "#737373"}
            />
            <Text
              style={{
                color: activeTab === "video" ? "#f5f5f4" : "#a3a3a3",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Video
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("saved")}
            className="flex-row items-center justify-center gap-1 flex-1"
          >
            <Bookmark
              size={14}
              color={activeTab === "saved" ? "#f5f5f4" : "#737373"}
            />
            <Text
              style={{
                color: activeTab === "saved" ? "#f5f5f4" : "#a3a3a3",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Saved
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("tagged")}
            className="flex-row items-center justify-center gap-1 flex-1"
          >
            <Tag
              size={14}
              color={activeTab === "tagged" ? "#f5f5f4" : "#737373"}
            />
            <Text
              style={{
                color: activeTab === "tagged" ? "#f5f5f4" : "#a3a3a3",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Tagged
            </Text>
          </Pressable>
        </View>

        {/* Post Grid - min height prevents jumping */}
        <View style={{ minHeight: columnWidth * 2 }}>
          {displayPosts.length > 0 ? (
            <View className="flex-row flex-wrap">
              {displayPosts.map((item, index) => (
                <Motion.View
                  key={`${activeTab}-${item.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    type: "spring",
                    damping: 20,
                    stiffness: 100,
                    delay: index * 0.03,
                  }}
                  style={{
                    width: columnWidth,
                    height: columnWidth,
                    padding: 1,
                  }}
                >
                  <Pressable
                    onPress={() => router.push(`/post/${item.id}`)}
                    className="flex-1 rounded-sm overflow-hidden"
                  >
                    <SharedImage
                      source={{ uri: item.thumbnail }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      sharedTag={`post-image-${item.id}`}
                    />
                    {item.type === "video" && (
                      <View className="absolute top-2 right-2">
                        <Play size={18} color="#fff" fill="#fff" />
                      </View>
                    )}
                  </Pressable>
                </Motion.View>
              ))}
            </View>
          ) : (
            <View className="items-center justify-center py-16">
              <Bookmark size={48} color={colors.mutedForeground} />
              <Text className="mt-4 text-base text-muted-foreground">
                {activeTab === "saved"
                  ? "No saved posts yet"
                  : activeTab === "tagged"
                    ? "No tagged posts yet"
                    : activeTab === "video"
                      ? "No videos yet"
                      : "No posts yet"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
