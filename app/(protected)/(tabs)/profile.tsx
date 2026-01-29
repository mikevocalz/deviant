import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SharedImage } from "@/components/shared-image";
import { Avatar } from "@/components/ui/avatar";
import {
  Settings,
  Album,
  Film,
  Bookmark,
  Tag,
  Play,
  Camera,
  Grid3x3,
} from "lucide-react-native";
import { useRouter, useNavigation } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import {
  useMemo,
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { useProfileStore } from "@/lib/stores/profile-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { ProfileSkeleton } from "@/components/skeletons";
import { Motion } from "@legendapp/motion";
import { useProfilePosts, usePostsByIds } from "@/lib/hooks/use-posts";
import { useMyProfile } from "@/lib/hooks/use-profile";
import { useBookmarks } from "@/lib/hooks/use-bookmarks";
import { notificationKeys } from "@/lib/hooks/use-notifications-query";
import * as ImagePicker from "expo-image-picker";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { users } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";

const { width } = Dimensions.get("window");
const columnWidth = (width - 6) / 3;

// Edit Profile is now handled by /(protected)/profile/edit.tsx modal

/**
 * mapPostToGridTile - Shared mapper for profile grid tiles
 * Handles carousel/video indicators and safe thumbnail extraction
 */
function mapPostToGridTile(post: any): {
  id: string;
  kind: "image" | "carousel" | "video";
  coverUrl: string | undefined;
  mediaCount: number;
} {
  if (!post || !post.id) {
    return { id: "", kind: "image", coverUrl: undefined, mediaCount: 0 };
  }

  const media = Array.isArray(post.media) ? post.media : [];
  const mediaCount = media.length;

  // Determine kind
  let kind: "image" | "carousel" | "video" = "image";
  if (mediaCount > 1) {
    kind = "carousel";
  } else if (media[0]?.type === "video") {
    kind = "video";
  }

  // Extract cover URL with fallbacks for video
  let coverUrl: string | undefined;
  if (kind === "video") {
    // Video: prefer posterUrl > thumbnail > first frame
    coverUrl = media[0]?.posterUrl || media[0]?.thumbnail || media[0]?.url;
  } else {
    // Image/carousel: first image thumbnail or url
    coverUrl = media[0]?.thumbnail || media[0]?.url;
  }

  // Validate URL
  if (
    coverUrl &&
    !coverUrl.startsWith("http://") &&
    !coverUrl.startsWith("https://")
  ) {
    coverUrl = undefined;
  }

  return {
    id: String(post.id),
    kind,
    coverUrl,
    mediaCount,
  };
}

function ProfileScreenContent() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const { activeTab, setActiveTab } = useProfileStore();
  const bookmarkStore = useBookmarkStore();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  // Avatar update state
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // CRITICAL: Fetch profile data with counts from backend
  // This is the canonical source for followersCount, followingCount, postsCount
  const {
    data: profileData,
    isLoading: isLoadingProfile,
    refetch: refetchProfile,
  } = useMyProfile();
  const { uploadSingle } = useMediaUpload({
    folder: "avatars",
    userId: user?.id,
  });

  // Direct avatar update - opens photo picker and updates immediately
  const handleAvatarPress = useCallback(async () => {
    if (isUpdatingAvatar) return;

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "error",
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

      if (result.canceled || !result.assets[0]) return;

      setIsUpdatingAvatar(true);
      const selectedUri = result.assets[0].uri;

      // Upload to Bunny CDN
      const uploadResult = await uploadSingle(selectedUri);
      if (!uploadResult.success || !uploadResult.url) {
        showToast(
          "error",
          "Upload Failed",
          "Failed to upload image. Please try again.",
        );
        setIsUpdatingAvatar(false);
        return;
      }

      // Update profile with new avatar
      await users.updateMe({ avatar: uploadResult.url });

      const newAvatarUrl = uploadResult.url;

      // Update local auth store
      if (user) {
        setUser({ ...user, avatar: newAvatarUrl });
      }

      // CRITICAL: Patch all caches where MY avatar appears
      // This ensures instant UI sync across the entire app
      const userId = user?.id;
      const username = user?.username;

      // 1. Invalidate profile caches (will refetch with new avatar)
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      }
      if (username) {
        queryClient.invalidateQueries({
          queryKey: ["profile", "username", username],
        });
      }

      // 2. Patch feed cache - update my posts' author avatar
      queryClient.setQueryData(["posts", "feed"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((post: any) => {
          if (
            String(post.author?.id) === String(userId) ||
            post.author?.username === username
          ) {
            return {
              ...post,
              author: { ...post.author, avatar: newAvatarUrl },
            };
          }
          return post;
        });
      });

      // 3. Patch infinite feed cache
      queryClient.setQueryData(["posts", "feed", "infinite"], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((post: any) => {
              if (
                String(post.author?.id) === String(userId) ||
                post.author?.username === username
              ) {
                return {
                  ...post,
                  author: { ...post.author, avatar: newAvatarUrl },
                };
              }
              return post;
            }),
          })),
        };
      });

      // 4. Patch profile posts cache
      if (userId) {
        queryClient.setQueryData(["profilePosts", userId], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((post: any) => ({
            ...post,
            author: { ...post.author, avatar: newAvatarUrl },
          }));
        });
      }

      // 5. Patch stories cache - update MY stories' avatar
      queryClient.setQueryData(["stories"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((story: any) => {
          if (
            String(story.userId) === String(userId) ||
            story.username === username
          ) {
            return { ...story, avatar: newAvatarUrl };
          }
          return story;
        });
      });

      console.log(
        "[Profile] Avatar synced to auth store, feed, profile posts, and stories",
      );
      showToast("success", "Updated", "Profile photo updated!");
    } catch (error: any) {
      console.error("[Profile] Avatar update error:", error);
      showToast("error", "Error", error?.message || "Failed to update photo");
    } finally {
      setIsUpdatingAvatar(false);
    }
  }, [isUpdatingAvatar, uploadSingle, user, setUser, queryClient, showToast]);

  // Navigate to edit profile modal
  const handleOpenEditSheet = useCallback(() => {
    router.push("/(protected)/profile/edit");
  }, [router]);

  // PHASE 0: Compute display values from profileData (API) with user (auth store) fallback
  // CRITICAL: profileData is the canonical source, user is fallback only
  const displayAvatar =
    profileData?.avatar || profileData?.avatarUrl || user?.avatar;
  const displayName =
    profileData?.displayName || profileData?.name || user?.name || "User";
  const displayUsername = profileData?.username || user?.username || "";
  const displayBio = profileData?.bio || user?.bio;
  const displayLocation = user?.location; // Only in auth store
  const displayWebsite = user?.website; // Only in auth store
  const displayHashtags = user?.hashtags; // Only in auth store
  const displayFollowersCount =
    profileData?.followersCount ?? user?.followersCount ?? 0;
  const displayFollowingCount =
    profileData?.followingCount ?? user?.followingCount ?? 0;
  const displayPostsCount = profileData?.postsCount ?? user?.postsCount ?? 0;

  // PHASE 0 INSTRUMENTATION: Log profile data sources
  if (__DEV__) {
    console.log("[Profile] Data sources:", {
      userId: user?.id,
      profileDataExists: !!profileData,
      displayAvatar: displayAvatar?.slice(0, 50),
      displayName,
      displayUsername,
      counts: {
        followers: displayFollowersCount,
        following: displayFollowingCount,
        posts: displayPostsCount,
      },
      isLoadingProfile,
    });
  }

  // DEFENSIVE: Wrap useBookmarks in try-catch pattern via safe defaults
  const bookmarksQuery = useBookmarks();
  const bookmarkedPostIds = bookmarksQuery.data ?? [];
  const bookmarksError = bookmarksQuery.isError;
  const bookmarksQueryError = bookmarksQuery.error;

  // Log bookmarks query state
  console.log("[Profile] Bookmarks:", {
    count: Array.isArray(bookmarkedPostIds) ? bookmarkedPostIds.length : 0,
    isError: bookmarksError,
    error: bookmarksQueryError?.message,
  });
  // Sync API bookmarks to local store - use API bookmarks as source of truth
  // Defensive: ensure bookmarkedPostIds is always an array
  const safeBookmarkedPostIds = Array.isArray(bookmarkedPostIds)
    ? bookmarkedPostIds
    : [];

  // DEFENSIVE: Safely get bookmarks from store with fallback
  let storeBookmarks: string[] = [];
  try {
    storeBookmarks = bookmarkStore.getBookmarkedPostIds() || [];
  } catch (e) {
    console.error("[Profile] Error getting bookmarks from store:", e);
  }

  const bookmarkedPosts =
    safeBookmarkedPostIds.length > 0 ? safeBookmarkedPostIds : storeBookmarks;
  const { loadingScreens, setScreenLoading } = useUIStore();
  // user is already declared above with setUser
  const isLoading = loadingScreens.profile;

  // PHASE 1 INSTRUMENTATION: Log user state
  console.log("[Profile] User:", {
    id: user?.id,
    username: user?.username,
    hasUser: !!user,
  });

  // Logged-in user ID - safe even if user is null
  const loggedInUserId = String(user?.id || "");
  console.log("[Profile] loggedInUserId:", loggedInUserId);

  // Track previous user ID to detect user switches
  const prevUserIdRef = useRef<string | null>(null);

  // Set up header with useLayoutEffect - MUST be called unconditionally
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerLeft: () => null, // No left header button
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
    error: postsQueryError,
    refetch,
  } = useProfilePosts(loggedInUserId);

  // PHASE 1 INSTRUMENTATION: Log posts query state with date range
  if (__DEV__) {
    const postDates =
      userPostsData
        ?.map((p) => p.createdAt)
        .filter(Boolean)
        .sort() || [];
    console.log("[Profile] Posts:", {
      count: userPostsData?.length || 0,
      isLoading: isLoadingPosts,
      isError: postsError,
      error: postsQueryError?.message,
      oldestCreatedAt: postDates[0] || null,
      newestCreatedAt: postDates[postDates.length - 1] || null,
    });
  }

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

  // CRITICAL: Refetch profile on app foreground to get updated follower counts
  // This ensures counts are updated when someone follows the user while app was backgrounded
  useEffect(() => {
    const { AppState } = require("react-native");
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: string) => {
        if (nextAppState === "active") {
          console.log("[Profile] App foregrounded, refetching profile data");
          refetchProfile();
          refetch(); // Also refetch posts
          if (loggedInUserId) {
            queryClient.invalidateQueries({
              queryKey: notificationKeys.list(loggedInUserId),
            });
          }
        }
      },
    );
    return () => subscription.remove();
  }, [refetchProfile, refetch, loggedInUserId, queryClient]);

  // Transform user posts data using shared mapper - with defensive guards
  const userPosts = useMemo(() => {
    try {
      if (!userPostsData || !Array.isArray(userPostsData)) return [];
      return userPostsData
        .filter((post) => post && post.id)
        .map(mapPostToGridTile);
    } catch (e) {
      console.error("[Profile] Error transforming user posts:", e);
      return [];
    }
  }, [userPostsData]);

  // Fetch bookmarked posts
  const { data: bookmarkedPostsData = [] } = usePostsByIds(bookmarkedPosts);

  const savedPosts = useMemo(() => {
    try {
      if (
        !bookmarkedPostsData ||
        !Array.isArray(bookmarkedPostsData) ||
        bookmarkedPostsData.length === 0
      ) {
        return [];
      }
      return bookmarkedPostsData
        .filter((post) => post && post.id)
        .map(mapPostToGridTile);
    } catch (e) {
      console.error("[Profile] Error transforming saved posts:", e);
      return [];
    }
  }, [bookmarkedPostsData]);

  const videoPosts = useMemo(() => {
    try {
      return Array.isArray(userPosts)
        ? userPosts.filter((p) => p?.kind === "video")
        : [];
    } catch (e) {
      console.error("[Profile] Error filtering video posts:", e);
      return [];
    }
  }, [userPosts]);
  const taggedPosts: typeof userPosts = []; // Placeholder for tagged posts

  const displayPosts = useMemo(() => {
    try {
      switch (activeTab) {
        case "posts":
          return Array.isArray(userPosts) ? userPosts : [];
        case "video":
          return Array.isArray(videoPosts) ? videoPosts : [];
        case "saved":
          return Array.isArray(savedPosts) ? savedPosts : [];
        case "tagged":
          return Array.isArray(taggedPosts) ? taggedPosts : [];
        default:
          return Array.isArray(userPosts) ? userPosts : [];
      }
    } catch (e) {
      console.error("[Profile] Error getting display posts:", e);
      return [];
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
    <View className="flex-1 bg-background" testID="screen.profile">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-5"
      >
        <View className="px-5 pt-5 pb-4">
          {/* Centered Profile Header */}
          <View className="items-center">
            <View className="flex-row items-center justify-center gap-8 mb-6">
              {/* Avatar - tap to change photo directly */}
              <Pressable
                onPress={handleAvatarPress}
                disabled={isUpdatingAvatar}
                testID={`profile.${user?.id}.avatar`}
              >
                <View className="relative">
                  <Avatar
                    uri={displayAvatar}
                    username={displayName}
                    size={88}
                    variant="roundedSquare"
                  />
                  <View
                    className="absolute -bottom-1 left-1/2 h-7 w-7 items-center justify-center rounded-full bg-primary border-2"
                    style={{
                      borderColor: colors.background,
                      transform: [{ translateX: -14 }],
                    }}
                  >
                    {isUpdatingAvatar ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Camera size={14} color="#fff" />
                    )}
                  </View>
                </View>
              </Pressable>
              <View className="flex-row gap-8">
                <View
                  className="items-center"
                  testID={`profile.${user?.id}.postsCount`}
                >
                  <Text className="text-xl font-bold text-foreground">
                    {displayPostsCount}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Posts</Text>
                </View>
                <Pressable
                  className="items-center"
                  testID={`profile.${user?.id}.followersCount`}
                  onPress={() => {
                    if (user?.id) {
                      router.push(
                        `/(protected)/profile/followers?userId=${user.id}&username=${displayUsername}`,
                      );
                    }
                  }}
                >
                  <Text className="text-xl font-bold text-foreground">
                    {formatCount(displayFollowersCount)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Followers
                  </Text>
                </Pressable>
                <Pressable
                  className="items-center"
                  testID={`profile.${user?.id}.followingCount`}
                  onPress={() => {
                    if (user?.id) {
                      router.push(
                        `/(protected)/profile/following?userId=${user.id}&username=${displayUsername}`,
                      );
                    }
                  }}
                >
                  <Text className="text-xl font-bold text-foreground">
                    {formatCount(displayFollowingCount)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Following
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-base font-semibold text-foreground">
              {displayName}
            </Text>
            {displayBio && (
              <Text className="mt-1.5 text-sm leading-5 text-foreground/90">
                {displayBio}
              </Text>
            )}
            {displayLocation && (
              <Text className="mt-1.5 text-sm text-muted-foreground">
                {displayLocation}
              </Text>
            )}
            {displayWebsite && (
              <Text className="mt-1.5 text-sm font-medium text-primary">
                {displayWebsite}
              </Text>
            )}
            {Array.isArray(displayHashtags) && displayHashtags.length > 0 && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {displayHashtags.map((tag, index) => (
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
            <Pressable
              onPress={handleOpenEditSheet}
              testID="settings.editProfile.open"
              className="flex-1 items-center justify-center py-2.5 rounded-[10px] bg-secondary px-4"
            >
              <Text className="font-semibold text-secondary-foreground">
                Edit profile
              </Text>
            </Pressable>
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
        <View
          style={{ minHeight: columnWidth * 2 }}
          testID={`profile.${user?.id}.grid`}
        >
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
                        console.log("[Profile] Navigating to post:", item.id);
                        router.push(`/(protected)/post/${item.id}`);
                      }
                    }}
                    testID={`profile.${user?.id}.gridTile.${item.id}`}
                    className="flex-1 rounded-sm overflow-hidden"
                  >
                    {item.coverUrl ? (
                      <SharedImage
                        source={{ uri: item.coverUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        sharedTag={`post-image-${item.id}`}
                      />
                    ) : (
                      <View
                        className="flex-1 items-center justify-center bg-border"
                        style={{ width: "100%", height: "100%" }}
                      >
                        <Text className="text-xs text-muted-foreground text-center">
                          No preview
                        </Text>
                      </View>
                    )}
                    {item.kind === "video" && (
                      <View className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                        <Play size={16} color="#fff" fill="#fff" />
                      </View>
                    )}
                    {item.kind === "carousel" && (
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

      {/* Edit Profile now uses modal navigation - see /(protected)/profile/edit */}
    </View>
  );
}

// PHASE 5: Wrap with ErrorBoundary for crash protection
export default function ProfileScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="Profile"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
    >
      <ProfileScreenContent />
    </ErrorBoundary>
  );
}
