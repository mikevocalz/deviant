import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
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
  Plus,
} from "lucide-react-native";
import { useRouter, useNavigation } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useMemo, useEffect, useState, useLayoutEffect, useRef } from "react";
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
import { useBookmarks } from "@/lib/hooks/use-bookmarks";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { TextInput, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { users } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

const { width } = Dimensions.get("window");
const columnWidth = (width - 6) / 3;

// Edit Profile Content Component
function EditProfileContent() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isSaving, setIsSaving] = useState(false);
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const { uploadSingle, isUploading, progress } = useMediaUpload({
    folder: "avatars",
    userId: user?.id,
  });
  const {
    editBio,
    editWebsite,
    editLocation,
    editHashtags,
    setEditBio,
    setEditWebsite,
    setEditLocation,
    setEditHashtags,
    addEditHashtag,
    removeEditHashtag,
  } = useProfileStore();
  const { setOpen: setPopoverOpen } = usePopover();
  const [hashtagInput, setHashtagInput] = useState("");

  const handlePickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant media library access to change your photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[EditProfile] Pick avatar error:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const showToast = useUIStore.getState().showToast;

    try {
      let avatarUrl = user.avatar;

      // Upload new avatar if selected
      if (newAvatarUri) {
        console.log("[EditProfile] Uploading avatar...");
        const uploadResult = await uploadSingle(newAvatarUri);
        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url;
          console.log("[EditProfile] Avatar uploaded:", avatarUrl);
        } else {
          console.error("[EditProfile] Avatar upload failed");
          showToast(
            "warning",
            "Upload Issue",
            "Avatar upload failed. Other changes will be saved.",
          );
        }
      }

      const updateData = {
        bio: editBio,
        website: editWebsite,
        avatar: avatarUrl,
        location: editLocation,
        hashtags: editHashtags,
      };

      console.log(
        "[EditProfile] Updating profile with:",
        JSON.stringify(updateData),
      );
      console.log("[EditProfile] User ID:", user.id);

      await users.updateMe(updateData);
      console.log("[EditProfile] Profile updated successfully");

      setUser({
        ...user,
        bio: editBio,
        website: editWebsite,
        avatar: avatarUrl,
        location: editLocation,
        hashtags: editHashtags,
      });

      // Invalidate user queries to refresh profile data everywhere
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users", "username"] });
      if (user?.username) {
        queryClient.invalidateQueries({
          queryKey: ["users", "username", user.username],
        });
      }

      // Force image cache refresh by updating timestamp
      if (avatarUrl && avatarUrl !== user.avatar) {
        // The Image component will pick up the new URL automatically
        // But we can force a refresh by ensuring the URL is different
        console.log(
          "[EditProfile] Avatar updated from",
          user.avatar,
          "to",
          avatarUrl,
        );
      }

      setNewAvatarUri(null);
      setPopoverOpen(false);
      showToast("success", "Saved", "Profile updated successfully");
    } catch (error: any) {
      console.error("[EditProfile] Save error:", error);
      console.error(
        "[EditProfile] Error details:",
        JSON.stringify(error, null, 2),
      );
      showToast(
        "error",
        "Error",
        error?.message || "Failed to save profile. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (user) {
      setEditBio(user.bio || "");
      setEditWebsite(user.website || "");
      setEditLocation(user.location || "");
      setEditHashtags(Array.isArray(user.hashtags) ? user.hashtags : []);
    }
  }, [user, setEditBio, setEditWebsite, setEditLocation, setEditHashtags]);

  const hashtagsEqual =
    editHashtags.length === (user?.hashtags?.length ?? 0) &&
    editHashtags.every((t, i) => (user?.hashtags ?? [])[i] === t);
  const hasChanges =
    editBio !== (user?.bio || "") ||
    editWebsite !== (user?.website || "") ||
    editLocation !== (user?.location || "") ||
    !hashtagsEqual ||
    newAvatarUri !== null;

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.card }}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={100}
      enabled={true}
    >
      {/* Header - Inside Popover */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-4 border-b border-border">
        <Pressable
          onPress={() => setPopoverOpen(false)}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} color={colors.foreground} strokeWidth={2.5} />
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
                color={
                  hasChanges ? colors.primaryForeground : colors.mutedForeground
                }
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

      {/* Avatar Section */}
      <View className="items-center py-8">
        <Pressable
          onPress={handlePickAvatar}
          disabled={isUploading}
          className="relative"
        >
          <Image
            source={{
              uri:
                newAvatarUri ||
                user?.avatar ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(user?.name || "User"),
            }}
            className="w-32 h-32 rounded-full"
            contentFit="cover"
          />
          {isUploading ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
              <ActivityIndicator color="#fff" size="large" />
              <Text className="text-white text-sm mt-2 font-semibold">
                {Math.round(progress)}%
              </Text>
            </View>
          ) : (
            <View
              className="absolute -bottom-2 left-1/2 h-10 w-10 items-center justify-center rounded-full bg-primary border-4"
              style={{
                borderColor: colors.card,
                transform: [{ translateX: -20 }],
              }}
            >
              <Camera size={18} color="#fff" />
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={handlePickAvatar}
          disabled={isUploading}
          className="mt-4"
        >
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

        <View>
          <Text
            style={{ color: colors.mutedForeground }}
            className="mb-3 text-sm font-semibold"
          >
            Location
          </Text>
          <TextInput
            value={editLocation}
            onChangeText={setEditLocation}
            placeholder="City, region, or country"
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
            Hashtags (max 10)
          </Text>
          <View className="flex-row gap-2 flex-wrap mb-2">
            {editHashtags.map((tag, index) => (
              <Badge
                key={tag + index}
                variant="secondary"
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-medium text-secondary-foreground">
                  #{tag}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => removeEditHashtag(index)}
                  className="ml-0.5"
                >
                  <X size={12} color={colors.mutedForeground} />
                </Pressable>
              </Badge>
            ))}
          </View>
          {editHashtags.length < 10 && (
            <View className="flex-row gap-2 items-center">
              <TextInput
                value={hashtagInput}
                onChangeText={setHashtagInput}
                placeholder="Add tag (e.g. music)"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                onSubmitEditing={() => {
                  const t = hashtagInput
                    .replace(/^#+/, "")
                    .trim()
                    .toLowerCase();
                  if (t) {
                    addEditHashtag(t);
                    setHashtagInput("");
                  }
                }}
                style={{
                  flex: 1,
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => {
                  const t = hashtagInput
                    .replace(/^#+/, "")
                    .trim()
                    .toLowerCase();
                  if (t) {
                    addEditHashtag(t);
                    setHashtagInput("");
                  }
                }}
                className="h-11 w-11 items-center justify-center rounded-full bg-primary"
              >
                <Plus size={20} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const { activeTab, setActiveTab } = useProfileStore();
  const bookmarkStore = useBookmarkStore();
  const { data: bookmarkedPostIds = [], isError: bookmarksError } =
    useBookmarks();
  // Sync API bookmarks to local store - use API bookmarks as source of truth
  // Defensive: ensure bookmarkedPostIds is always an array
  const safeBookmarkedPostIds = Array.isArray(bookmarkedPostIds)
    ? bookmarkedPostIds
    : [];
  const bookmarkedPosts =
    safeBookmarkedPostIds.length > 0
      ? safeBookmarkedPostIds
      : bookmarkStore.getBookmarkedPostIds();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const isLoading = loadingScreens.profile;

  // Logged-in user ID - safe even if user is null
  const loggedInUserId = String(user?.id || "");

  // Track previous user ID to detect user switches
  const prevUserIdRef = useRef<string | null>(null);

  // Set up header with useLayoutEffect - MUST be called unconditionally
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerLeft: "Profile",
      headerTitleAlign: "center" as const,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerTitle: () => (
        <View style={{ marginLeft: 3 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            @{user?.username || ""}
          </Text>
        </View>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={12}
          style={{
            marginRight: 8,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Settings size={24} color={colors.foreground} />
        </Pressable>
      ),
    });
  }, [navigation, user?.username, colors, router]);

  // Fetch real user posts - ONLY for logged-in user
  // Must be called unconditionally (React hooks rule)
  const {
    data: userPostsData,
    isLoading: isLoadingPosts,
    isError: postsError,
    refetch,
  } = useProfilePosts(loggedInUserId);

  // CRITICAL: When user ID changes (user switched), force refetch and clear stale data
  useEffect(() => {
    if (
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== loggedInUserId
    ) {
      console.log(
        "[Profile] User switched from",
        prevUserIdRef.current,
        "to",
        loggedInUserId,
      );
      // Force refetch for the new user
      refetch();
    }

    prevUserIdRef.current = loggedInUserId;
  }, [loggedInUserId, refetch]);

  // Load profile screen loading state
  useEffect(() => {
    const loadProfile = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setScreenLoading("profile", false);
    };
    loadProfile();
  }, [setScreenLoading]);

  // Transform user posts data - with defensive guards to prevent crashes
  const userPosts = useMemo(() => {
    if (!userPostsData || !Array.isArray(userPostsData)) return [];
    return userPostsData
      .filter((post) => post && post.id) // Filter out invalid posts
      .map((post) => {
        try {
          const media = Array.isArray(post.media) ? post.media : [];
          const thumbnailUrl = media[0]?.url;
          // Only use valid HTTP/HTTPS URLs, skip relative paths
          const isValidUrl =
            thumbnailUrl &&
            (thumbnailUrl.startsWith("http://") ||
              thumbnailUrl.startsWith("https://"));
          return {
            id: String(post.id),
            thumbnail: isValidUrl ? thumbnailUrl : undefined,
            type: media[0]?.type === "video" ? "video" : "image",
            mediaCount: media.length,
            hasMultipleImages: media.length > 1 && media[0]?.type === "image",
          };
        } catch {
          // If any post transformation fails, return a safe fallback
          return {
            id: String(post.id),
            thumbnail: undefined,
            type: "image" as const,
            mediaCount: 0,
            hasMultipleImages: false,
          };
        }
      });
  }, [userPostsData]);

  // Fetch bookmarked posts
  const { data: bookmarkedPostsData = [] } = usePostsByIds(bookmarkedPosts);

  const savedPosts = useMemo(() => {
    if (
      !bookmarkedPostsData ||
      !Array.isArray(bookmarkedPostsData) ||
      bookmarkedPostsData.length === 0
    )
      return [];
    return bookmarkedPostsData
      .filter((post) => post && post.id) // Filter out invalid posts
      .map((post) => {
        try {
          const media = Array.isArray(post.media) ? post.media : [];
          const thumbnailUrl = media[0]?.url;
          // Only use valid HTTP/HTTPS URLs, skip relative paths
          const isValidUrl =
            thumbnailUrl &&
            (thumbnailUrl.startsWith("http://") ||
              thumbnailUrl.startsWith("https://"));
          return {
            id: String(post.id),
            thumbnail: isValidUrl ? thumbnailUrl : undefined,
            type: media[0]?.type === "video" ? "video" : "image",
            mediaCount: media.length,
            hasMultipleImages: media.length > 1 && media[0]?.type === "image",
          };
        } catch {
          return {
            id: String(post.id),
            thumbnail: undefined,
            type: "image" as const,
            mediaCount: 0,
            hasMultipleImages: false,
          };
        }
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

  // Format follower count (e.g., 24800 -> "24.8K")
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // CRITICAL: Early return if no user - MUST come AFTER all hooks
  // This ensures hooks are called in same order every render (React rules)
  if (!user) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading profile...</Text>
      </View>
    );
  }

  if (isLoading || isLoadingPosts) {
    return (
      <View className="flex-1 bg-background">
        <ProfileSkeleton />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-5"
      >
        <View className="px-5 pt-5 pb-4">
          {/* Centered Profile Header */}
          <View className="items-center">
            <View className="flex-row items-center justify-center gap-8 mb-6">
              <Popover>
                <PopoverTrigger>
                  <View className="relative">
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
                    <View
                      className="absolute -bottom-1 left-1/2 h-7 w-7 items-center justify-center rounded-full bg-primary border-2"
                      style={{
                        borderColor: colors.background,
                        transform: [{ translateX: -14 }],
                      }}
                    >
                      <Camera size={14} color="#fff" />
                    </View>
                  </View>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="center"
                  className="w-[90%] max-w-md max-h-[85%]"
                >
                  <EditProfileContent />
                </PopoverContent>
              </Popover>
              <View className="flex-row gap-8">
                <View className="items-center">
                  <Text className="text-xl font-bold text-foreground">
                    {userPostsData?.length || 0}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Posts</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xl font-bold text-foreground">
                    {formatCount(user?.followersCount || 0)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Followers
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-xl font-bold text-foreground">
                    {formatCount(user?.followingCount || 0)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Following
                  </Text>
                </View>
              </View>
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
            {user?.location && (
              <Text className="mt-1.5 text-sm text-muted-foreground">
                {user.location}
              </Text>
            )}
            {user?.website && (
              <Text className="mt-1.5 text-sm font-medium text-primary">
                {user.website}
              </Text>
            )}
            {Array.isArray(user?.hashtags) && user.hashtags.length > 0 && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {user.hashtags.map((tag, index) => (
                  <Badge key={tag + index} variant="secondary">
                    <Text className="text-xs font-medium text-secondary-foreground">
                      #{tag}
                    </Text>
                  </Badge>
                ))}
              </View>
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
              <PopoverContent
                side="bottom"
                align="center"
                className="w-[90%] max-w-md max-h-[85%]"
              >
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
                    onPress={() => {
                      if (item?.id) {
                        router.push(`/(protected)/post/${item.id}`);
                      }
                    }}
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
