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
import { Image } from "expo-image";
import {
  Settings,
  Album,
  Film,
  Bookmark,
  Tag,
  Play,
  Camera,
  Grid3x3,
  CalendarDays,
  Heart,
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
import { useMyEvents, useLikedEvents } from "@/lib/hooks/use-events";
import { notificationKeys } from "@/lib/hooks/use-notifications-query";
import * as ImagePicker from "expo-image-picker";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { usersApi } from "@/lib/api/users";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  safeProfile,
  safeGridTiles,
  safeBookmarkIds,
  formatCountSafe,
  type SafeProfileData,
  type SafeGridTile,
} from "@/lib/utils/safe-profile-mappers";
import { getFallbackAvatarUrl } from "@/lib/media/resolveAvatarUrl";
import { ProfileScreenGuard } from "@/components/profile/ProfileScreenGuard";

const { width } = Dimensions.get("window");
const columnWidth = (width - 6) / 3;

// Edit Profile is now handled by /(protected)/profile/edit.tsx modal

// mapPostToGridTile is now replaced by safeGridTiles from safe-profile-mappers.ts

function ProfileScreenContent() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  // DEFENSIVE: Get stores safely
  const { activeTab, setActiveTab } = useProfileStore();
  const bookmarkStore = useBookmarkStore();

  // Avatar update state
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // CRITICAL: userId must exist before any queries run
  // This is the KEY guard that prevents crashes
  const userId = user?.id ? String(user.id) : "";
  const hasUser = Boolean(userId);

  // CRITICAL: Fetch profile data with counts from backend
  // ONLY enabled when we have a valid userId
  const {
    data: profileData,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    error: profileError,
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

      // OPTIMISTIC: Show local image immediately before upload
      const previousAvatar = user?.avatar;
      if (user) {
        setUser({ ...user, avatar: selectedUri });
      }

      // Upload to Bunny CDN
      const uploadResult = await uploadSingle(selectedUri);
      if (!uploadResult.success || !uploadResult.url) {
        // ROLLBACK: Restore previous avatar on failure
        if (user) {
          setUser({ ...user, avatar: previousAvatar });
        }
        showToast(
          "error",
          "Upload Failed",
          "Failed to upload image. Please try again.",
        );
        setIsUpdatingAvatar(false);
        return;
      }

      // Update profile with new avatar on backend
      try {
        await usersApi.updateAvatar(uploadResult.url);
      } catch {
        // Backend update failed — rollback
        if (user) {
          setUser({ ...user, avatar: previousAvatar });
        }
        showToast("error", "Error", "Couldn't save changes. Try again.");
        setIsUpdatingAvatar(false);
        return;
      }

      const newAvatarUrl = uploadResult.url;

      // Update local auth store
      if (user) {
        setUser({ ...user, avatar: newAvatarUrl });
      }

      // CRITICAL: Patch all caches where MY avatar appears
      // This ensures instant UI sync across the entire app
      // Do NOT invalidate profile queries — that refetches from DB and overwrites
      // the optimistic value before the edge function write is visible.
      const userId = user?.id;
      const username = user?.username;

      // 1. Directly patch profile cache with new avatar (no refetch)
      if (userId) {
        queryClient.setQueryData(["profile", userId], (old: any) => {
          if (!old) return old;
          return { ...old, avatar: newAvatarUrl, avatarUrl: newAvatarUrl };
        });
      }
      if (username) {
        queryClient.setQueryData(
          ["profile", "username", username],
          (old: any) => {
            if (!old) return old;
            return { ...old, avatar: newAvatarUrl, avatarUrl: newAvatarUrl };
          },
        );
        // Also patch useUser cache (used by [username].tsx profile screen)
        queryClient.setQueryData(
          ["users", "username", username],
          (old: any) => {
            if (!old) return old;
            return { ...old, avatar: newAvatarUrl };
          },
        );
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
      // CRITICAL: useStories uses key ["stories", "list"], patch both
      const patchStories = (old: any) => {
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
      };
      queryClient.setQueryData(["stories"], patchStories);
      queryClient.setQueryData(["stories", "list"], patchStories);

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
  const displayName =
    profileData?.displayName || profileData?.name || user?.name || "User";
  const displayAvatar =
    profileData?.avatar || profileData?.avatarUrl || user?.avatar || "";
  // CRITICAL: Compute a guaranteed valid avatar URL — never pass empty string to Image
  const avatarUri =
    displayAvatar && displayAvatar.startsWith("http")
      ? displayAvatar
      : getFallbackAvatarUrl(displayName || user?.username || "User");
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
  const storeBookmarks = safeBookmarkIds(
    null,
    () => bookmarkStore.getBookmarkedPostIds() || [],
  );

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
  // Must be called unconditionally (React hooks rule) - BEFORE any early returns
  const {
    data: userPostsData,
    isLoading: isLoadingPosts,
    isError: postsError,
    error: postsQueryError,
    refetch,
  } = useProfilePosts(loggedInUserId);

  // Don't render if no user
  if (!user) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading profile...</Text>
      </View>
    );
  }

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

  // Transform user posts data using SAFE mapper - NEVER throws
  const userPosts: SafeGridTile[] = useMemo(() => {
    return safeGridTiles(userPostsData);
  }, [userPostsData]);

  // Fetch bookmarked posts
  const { data: bookmarkedPostsData = [] } = usePostsByIds(bookmarkedPosts);

  // Transform saved posts using SAFE mapper - NEVER throws
  const savedPosts: SafeGridTile[] = useMemo(() => {
    return safeGridTiles(bookmarkedPostsData);
  }, [bookmarkedPostsData]);

  // Filter video posts - safe with typed array
  const videoPosts: SafeGridTile[] = useMemo(() => {
    return userPosts.filter((p) => p.kind === "video");
  }, [userPosts]);

  const taggedPosts: SafeGridTile[] = []; // Placeholder for tagged posts

  // Fetch user's events (hosting + RSVP'd)
  const { data: myEvents = [] } = useMyEvents();

  // Fetch user's liked/saved events
  const { data: likedEvents = [] } = useLikedEvents();

  // Select display posts based on active tab - fully typed
  const displayPosts: SafeGridTile[] = useMemo(() => {
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
              <Pressable
                onPress={handleAvatarPress}
                disabled={isUpdatingAvatar}
              >
                <View className="relative">
                  <Image
                    source={{ uri: avatarUri }}
                    className="w-[88px] h-[88px] rounded-full"
                    style={{ backgroundColor: "#1a1a1a" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  {isUpdatingAvatar ? (
                    <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <View
                      className="absolute -bottom-1 left-1/2 h-7 w-7 items-center justify-center rounded-full bg-primary border-2"
                      style={{
                        borderColor: colors.background,
                        transform: [{ translateX: -14 }],
                      }}
                    >
                      <Camera size={14} color="#fff" />
                    </View>
                  )}
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
                    {formatCountSafe(displayFollowersCount)}
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
                    {formatCountSafe(displayFollowingCount)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Following
                  </Text>
                </Pressable>
                <Pressable
                  className="items-center"
                  testID={`profile.${user?.id}.eventsCount`}
                  onPress={() => setActiveTab("events")}
                >
                  <Text className="text-xl font-bold text-foreground">
                    {formatCountSafe(myEvents.length + likedEvents.length)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Events</Text>
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
              onPress={() => router.push("/(protected)/edit-profile")}
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
            onPress={() => setActiveTab("events")}
            className="flex-row items-center justify-center gap-1 flex-1"
          >
            <CalendarDays
              size={14}
              color={activeTab === "events" ? "#f5f5f4" : "#737373"}
            />
            <Text
              style={{
                color: activeTab === "events" ? "#f5f5f4" : "#a3a3a3",
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Events
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

        {/* Content based on active tab */}
        <View
          style={{ minHeight: columnWidth * 2 }}
          testID={`profile.${user?.id}.grid`}
        >
          {activeTab === "events" ? (
            <View className="px-4 pt-2">
              {/* My Events Section */}
              {myEvents.length > 0 && (
                <View className="mb-4">
                  <Text
                    style={{
                      color: "#a3a3a3",
                      fontSize: 13,
                      fontWeight: "600",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    My Events
                  </Text>
                  <View style={{ gap: 10 }}>
                    {myEvents.map((event: any, index: number) => (
                      <Motion.View
                        key={`myevent-${event.id}-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          type: "spring",
                          damping: 20,
                          stiffness: 100,
                          delay: index * 0.05,
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            router.push(
                              `/(protected)/events/${event.id}` as any,
                            )
                          }
                          className="flex-row items-center gap-3 p-3 rounded-xl"
                          style={{
                            backgroundColor: "rgba(28, 28, 28, 0.6)",
                            borderColor: "rgba(62, 164, 229, 0.15)",
                            borderWidth: 1,
                          }}
                        >
                          {event.image ? (
                            <Image
                              source={{ uri: event.image }}
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 10,
                                backgroundColor: "#1a1a1a",
                              }}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 10,
                                backgroundColor: "#1a1a1a",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <CalendarDays size={24} color="#737373" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text
                              className="text-foreground font-semibold text-sm"
                              numberOfLines={1}
                            >
                              {event.title}
                            </Text>
                            {event.date && (
                              <Text className="text-muted-foreground text-xs mt-0.5">
                                {new Date(event.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </Text>
                            )}
                            {event.location && (
                              <Text
                                className="text-muted-foreground text-xs mt-0.5"
                                numberOfLines={1}
                              >
                                {event.location}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      </Motion.View>
                    ))}
                  </View>
                </View>
              )}

              {/* Liked Events Section */}
              {likedEvents.length > 0 && (
                <View className="mb-4">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <Heart size={13} color="#FF5BFC" fill="#FF5BFC" />
                    <Text
                      style={{
                        color: "#a3a3a3",
                        fontSize: 13,
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Liked Events
                    </Text>
                  </View>
                  <View style={{ gap: 10 }}>
                    {likedEvents.map((event: any, index: number) => (
                      <Motion.View
                        key={`liked-${event.id}-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          type: "spring",
                          damping: 20,
                          stiffness: 100,
                          delay: index * 0.05,
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            router.push(
                              `/(protected)/events/${event.id}` as any,
                            )
                          }
                          className="flex-row items-center gap-3 p-3 rounded-xl"
                          style={{
                            backgroundColor: "rgba(28, 28, 28, 0.6)",
                            borderColor: "rgba(255, 91, 252, 0.15)",
                            borderWidth: 1,
                          }}
                        >
                          {event.image ? (
                            <Image
                              source={{ uri: event.image }}
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 10,
                                backgroundColor: "#1a1a1a",
                              }}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 10,
                                backgroundColor: "#1a1a1a",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Heart size={24} color="#FF5BFC" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text
                              className="text-foreground font-semibold text-sm"
                              numberOfLines={1}
                            >
                              {event.title}
                            </Text>
                            {event.date && (
                              <Text className="text-muted-foreground text-xs mt-0.5">
                                {new Date(event.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </Text>
                            )}
                            {event.location && (
                              <Text
                                className="text-muted-foreground text-xs mt-0.5"
                                numberOfLines={1}
                              >
                                {event.location}
                              </Text>
                            )}
                          </View>
                          <Heart
                            size={16}
                            color="#FF5BFC"
                            fill="#FF5BFC"
                            style={{ marginRight: 4 }}
                          />
                        </Pressable>
                      </Motion.View>
                    ))}
                  </View>
                </View>
              )}

              {/* Empty state */}
              {myEvents.length === 0 && likedEvents.length === 0 && (
                <View className="items-center justify-center py-16">
                  <CalendarDays size={48} color={colors.mutedForeground} />
                  <Text className="mt-4 text-base text-muted-foreground">
                    No events yet
                  </Text>
                </View>
              )}
            </View>
          ) : displayPosts.length > 0 ? (
            <View className="flex-row flex-wrap">
              {displayPosts.map((item: SafeGridTile, index: number) => (
                <Motion.View
                  key={`${activeTab}-${item.id}-${index}`}
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

// PHASE 5: Wrap with ErrorBoundary + ProfileScreenGuard for crash protection
export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const {
    isLoading: isLoadingProfile,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useMyProfile();

  return (
    <ErrorBoundary
      screenName="Profile"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
      debugContext={{
        userId: user?.id ? String(user.id) : undefined,
        queryKeys: [
          "authUser",
          `profile-${user?.id || "unknown"}`,
          `profilePosts-${user?.id || "unknown"}`,
          "bookmarks",
        ],
      }}
    >
      <ProfileScreenGuard
        isLoading={isLoadingProfile}
        isError={isProfileError}
        error={profileError}
        onRetry={refetchProfile}
      >
        <ProfileScreenContent />
      </ProfileScreenGuard>
    </ErrorBoundary>
  );
}
