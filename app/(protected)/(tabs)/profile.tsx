
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
  Grid3x3,
  X,
  Check,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useMemo, useEffect, useState } from "react";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { ProfileSkeleton } from "@/components/skeletons";
import { Motion } from "@legendapp/motion";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  usePopover,
} from "@/components/ui/popover";
import { useProfilePosts, usePostsByIds } from "@/lib/hooks/use-posts";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { TextInput } from "react-native";

const { width } = Dimensions.get("window");
const columnWidth = (width - 6) / 3;

// Edit Profile Content Component
function EditProfileContent() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isSaving, setIsSaving] = useState(false);
  const {
    editName,
    editBio,
    editWebsite,
    setEditName,
    setEditBio,
    setEditWebsite,
  } = useProfileStore();
  const { setOpen: setPopoverOpen } = usePopover();

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Update local auth store
      setUser({
        ...user,
        name: editName,
        bio: editBio,
        website: editWebsite,
      });
      setPopoverOpen(false);
    } catch (error) {
      console.error("[EditProfile] Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditBio(user.bio || "");
      setEditWebsite(user.website || "");
    }
  }, [user, setEditName, setEditBio, setEditWebsite]);

  const hasChanges =
    editName !== (user?.name || "") ||
    editBio !== (user?.bio || "") ||
    editWebsite !== (user?.website || "");

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pb-6 border-b border-border">
        <Pressable onPress={() => setPopoverOpen(false)} hitSlop={12}>
          <X size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving || !hasChanges}
          hitSlop={12}
          className={`px-4 py-2 rounded-full ${
            hasChanges && !isSaving ? "bg-primary" : "bg-muted"
          }`}
        >
          {isSaving ? (
            <Text className="text-sm font-semibold text-muted-foreground">
              Saving...
            </Text>
          ) : (
            <View className="flex-row items-center gap-2">
              <Check
                size={18}
                color={hasChanges ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                className={`text-sm font-semibold ${
                  hasChanges
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Save
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={100}
        enabled={true}
      >
        {/* Avatar Section */}
        <View className="items-center py-8">
          <View className="relative">
            <Image
              source={{
                uri:
                  user?.avatar ||
                  "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(user?.name || "User"),
              }}
              className="w-32 h-32 rounded-full"
              contentFit="cover"
            />
            <Pressable
              className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full bg-primary border-4"
              style={{ borderColor: colors.card }}
            >
              <Camera size={18} color="#fff" />
            </Pressable>
          </View>
          <Pressable className="mt-4">
            <Text className="text-base font-semibold text-primary">
              Change Photo
            </Text>
          </Pressable>
        </View>

        {/* Form Fields */}
        <View className="px-6 gap-6">
          <View>
            <Text
              style={{ color: colors.mutedForeground }}
              className="mb-3 text-sm font-semibold"
            >
              Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              style={{
                color: colors.foreground,
                backgroundColor: colors.muted,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
              }}
            />
          </View>

          <View>
            <Text
              style={{ color: colors.mutedForeground }}
              className="mb-3 text-sm font-semibold"
            >
              Bio
            </Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Write a short bio..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 100,
                color: colors.foreground,
                backgroundColor: colors.muted,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
              }}
            />
          </View>

          <View>
            <Text
              style={{ color: colors.mutedForeground }}
              className="mb-3 text-sm font-semibold"
            >
              Website
            </Text>
            <TextInput
              value={editWebsite}
              onChangeText={setEditWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="url"
              style={{
                color: colors.foreground,
                backgroundColor: colors.muted,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
              }}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { activeTab, setActiveTab } = useProfileStore();
  const bookmarkedPosts = useBookmarkStore((state) => state.bookmarkedPosts);
  const { loadingScreens, setScreenLoading } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const isLoading = loadingScreens.profile;
  
  // Fetch real user posts
  const { data: userPostsData, isLoading: isLoadingPosts } = useProfilePosts(user?.id || "");

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

  // Transform user posts data
  const userPosts = useMemo(() => {
    if (!userPostsData) return [];
    return userPostsData.map((post) => {
      const media = Array.isArray(post.media) ? post.media : [];
      return {
        id: post.id,
        thumbnail: media[0]?.url || "/placeholder.svg",
        type: media[0]?.type === "video" ? "video" : "image",
        mediaCount: media.length,
        hasMultipleImages: media.length > 1 && media[0]?.type === "image",
      };
    });
  }, [userPostsData]);

  // Fetch bookmarked posts
  const { data: bookmarkedPostsData = [] } = usePostsByIds(bookmarkedPosts);

  const savedPosts = useMemo(() => {
    if (!bookmarkedPostsData || bookmarkedPostsData.length === 0) return [];
    return bookmarkedPostsData.map((post) => {
      const media = Array.isArray(post.media) ? post.media : [];
      return {
        id: post.id,
        thumbnail: media[0]?.url || "/placeholder.svg",
        type: media[0]?.type === "video" ? "video" : "image",
        mediaCount: media.length,
        hasMultipleImages: media.length > 1 && media[0]?.type === "image",
      };
    });
  }, [bookmarkedPostsData]);

  const videoPosts = useMemo(
    () => userPosts.filter((p) => p.type === "video"),
    [userPosts],
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
  }, [activeTab, savedPosts, videoPosts, userPosts]);

  if (isLoading || isLoadingPosts) {
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
                  {userPostsData?.length || 0}
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

          <View className="mt-5 flex-row gap-2 px-4">
            <Popover>
              <PopoverTrigger>
                <View className="flex-1 items-center justify-center py-2.5 rounded-[10px] bg-secondary px-4">
                  <Text className="font-semibold text-secondary-foreground">
                    Edit profile
                  </Text>
                </View>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-[90%] max-w-md max-h-[85%]">
                <EditProfileContent />
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
                    onPress={() => router.push(`/(protected)/post/${item.id}`)}
                    className="flex-1 rounded-sm overflow-hidden"
                  >
                    <SharedImage
                      source={{ uri: item.thumbnail }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      sharedTag={`post-image-${item.id}`}
                    />
                    {item.type === "video" && (
                      <View className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                        <Play size={16} color="#fff" fill="#fff" />
                      </View>
                    )}
                    {item.hasMultipleImages && (
                      <View className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                        <Grid3x3 size={16} color="#fff" />
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
