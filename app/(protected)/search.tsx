import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
  Search,
  X,
  Play,
  Hash,
  Compass,
  MapPin,
} from "lucide-react-native";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui/avatar";
import { useSearchStore } from "@/lib/stores/search-store";
import { useEffect, useCallback, useMemo, useState } from "react";
import { Debouncer } from "@tanstack/pacer";
import { SearchSkeleton, SearchResultsSkeleton } from "@/components/skeletons";
import {
  useDiscoverData,
  useSearchResults,
  type DiscoverDTO,
} from "@/lib/hooks/use-search-screen";
import { BadgeCheck, UserPlus } from "lucide-react-native";
import { LegendList } from "@/components/list";
import { VideoThumbnailImage } from "@/components/ui/video-thumbnail-image";
import type { Post } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { navigateToPost } from "@/lib/routes/post-routes";
import {
  LocationAutocompleteV3,
  type LocationData,
} from "@/components/ui/location-autocomplete-v3";
import { TextPostSurface } from "@/components/post/TextPostSurface";
import { resolveTextPostPresentation } from "@/lib/posts/text-post";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const columnWidth = (SCREEN_WIDTH - 8) / 3;
const GRID_COLS = SCREEN_WIDTH >= 768 ? 5 : 4;
const GRID_GAP = 2;
const GRID_CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

function PostGridTile({
  post,
  size,
  router,
  queryClient,
}: {
  post: Post;
  size: number;
  router: ReturnType<typeof useRouter>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const firstMedia = post.media?.[0];
  const isTextPost = post.kind === "text";
  const textPostPreview = resolveTextPostPresentation(
    post.textSlides,
    post.caption,
  );
  const isVideo = post.type === "video" || firstMedia?.type === "video";
  const videoUrl = isVideo ? firstMedia?.url : undefined;
  const imageUri = post.thumbnail || (!isVideo ? firstMedia?.url : undefined);

  return (
    <Pressable
      onPress={() => {
        if (post.id) {
          navigateToPost(router, queryClient, post.id);
        }
      }}
      style={{
        width: size,
        height: size,
        padding: 1,
      }}
    >
      <View
        className="flex-1 overflow-hidden bg-secondary"
        style={{ borderRadius: 8 }}
      >
        {isTextPost ? (
          <TextPostSurface
            text={textPostPreview.previewText}
            theme={post.textTheme}
            variant="grid"
            style={{ minHeight: "100%", height: "100%" }}
          />
        ) : imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            {isVideo ? (
              <View className="absolute top-2 right-2">
                <Play size={20} color="#fff" fill="#fff" />
              </View>
            ) : null}
            {post.hasMultipleImages ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}
                >
                  +
                </Text>
              </View>
            ) : null}
          </>
        ) : videoUrl ? (
          <>
            <VideoThumbnailImage videoUrl={videoUrl} />
            <View className="absolute top-2 right-2">
              <Play size={20} color="#fff" fill="#fff" />
            </View>
          </>
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-muted-foreground text-xs">No preview</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function DiscoverSection({
  users,
}: {
  users: DiscoverDTO["users"];
}) {
  return (
    <View className="py-4">
      <View className="flex-row items-center gap-2 px-4 mb-4">
        <UserPlus size={20} color="#3FDCFF" />
        <Text className="text-lg font-bold text-foreground">
          Discover New Profiles
        </Text>
      </View>

      {users.length === 0 ? (
        <View className="px-4">
          <Text className="text-muted-foreground text-sm">
            No new profiles to discover right now.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {users.map((user) => (
            <Link
              key={user.id}
              href={
                {
                  pathname: "/(protected)/profile/[username]",
                  params: {
                    username: user.username,
                    authId: user.id,
                    avatar: user.avatar || "",
                    name: user.name || "",
                  },
                } as any
              }
              asChild
            >
              <Pressable
                style={{
                  width: 140,
                  backgroundColor: "rgba(30, 30, 30, 0.8)",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Avatar
                  uri={user.avatar}
                  username={user.username}
                  size="lg"
                  variant="roundedSquare"
                />
                <View className="flex-row items-center gap-1 mt-2">
                  <Text
                    className="text-sm font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {user.name}
                  </Text>
                  {user.verified && (
                    <BadgeCheck size={12} color="#FF6DC1" fill="#FF6DC1" />
                  )}
                </View>
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  @{user.username}
                </Text>
                {user.bio ? (
                  <Text
                    className="text-[11px] text-muted-foreground mt-1 px-3 text-center"
                    numberOfLines={2}
                  >
                    {user.bio}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DiscoverGrid({
  router,
  posts,
  queryClient,
}: {
  router: ReturnType<typeof useRouter>;
  posts: Post[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      return (
        <PostGridTile
          post={item}
          size={GRID_CELL_SIZE}
          router={router}
          queryClient={queryClient}
        />
      );
    },
    [queryClient, router],
  );

  if (posts.length === 0) return null;

  return (
    <View style={{ paddingTop: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        <Compass size={20} color="#3FDCFF" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#fff",
          }}
        >
          Explore
        </Text>
      </View>
      <LegendList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item: Post) => item.id}
        numColumns={GRID_COLS}
        estimatedItemSize={GRID_CELL_SIZE}
        recycleItems
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={{ gap: GRID_GAP }}
        scrollEnabled={false}
      />
    </View>
  );
}

function SearchScreenContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ query?: string }>();
  const searchQuery = useSearchStore((s) => s.searchQuery);
  const setSearchQuery = useSearchStore((s) => s.setSearchQuery);
  const debouncedSearch = useSearchStore((s) => s.debouncedSearch);
  const setDebouncedSearch = useSearchStore((s) => s.setDebouncedSearch);
  const clearSearch = useSearchStore((s) => s.clearSearch);
  const insets = useSafeAreaInsets();

  // Location search state
  const [searchMode, setSearchMode] = useState<"content" | "location">(
    "content",
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null,
  );

  // TanStack Debouncer — 300ms delay prevents query-per-keystroke
  const searchDebouncer = useMemo(
    () =>
      new Debouncer((text: string) => setDebouncedSearch(text), { wait: 300 }),
    [setDebouncedSearch],
  );

  // Use query from params if provided (e.g., when navigating from hashtag)
  useEffect(() => {
    if (params.query) {
      setSearchQuery(params.query);
      setDebouncedSearch(params.query);
    }
  }, [params.query, setSearchQuery, setDebouncedSearch]);

  // Consolidated queries — ONE for discover, ONE for search results
  const { data: discoverData, isLoading: isDiscoverLoading } =
    useDiscoverData();
  const { data: searchData, isLoading: isSearchLoading } =
    useSearchResults(debouncedSearch);

  const isHashtag = debouncedSearch.startsWith("#");
  const discoverPosts = useMemo(
    () => (discoverData?.posts || []).filter((post) => !post.isNSFW),
    [discoverData?.posts],
  );
  const searchResults = useMemo(
    () => (searchData?.posts?.docs || []).filter((post) => !post.isNSFW),
    [searchData?.posts?.docs],
  );
  const userResults = searchData?.users?.docs || [];

  const handleQueryChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      searchDebouncer.maybeExecute(text);
    },
    [setSearchQuery, searchDebouncer],
  );

  const handleClear = useCallback(() => {
    searchDebouncer.cancel();
    clearSearch();
    setSelectedLocation(null);
  }, [clearSearch, searchDebouncer]);

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      // Navigate to location results or show posts from this location
      router.push(`/location/${location.placeId || location.name}`);
    },
    [router],
  );

  const toggleSearchMode = useCallback(() => {
    setSearchMode((prev) => (prev === "content" ? "location" : "content"));
    clearSearch();
    setSelectedLocation(null);
  }, [clearSearch]);

  return (
    <View
      className="flex-1 bg-background max-w-3xl w-full self-center"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-1 flex-row items-center bg-secondary rounded-xl px-3">
          {searchMode === "content" ? (
            <Search size={20} color="#999" />
          ) : (
            <MapPin size={20} color="#999" />
          )}
          {searchMode === "content" ? (
            <TextInput
              value={searchQuery}
              onChangeText={handleQueryChange}
              placeholder={isHashtag ? "Search hashtags..." : "Search"}
              placeholderTextColor="#999"
              autoFocus={false}
              className="flex-1 h-10 ml-2 text-foreground"
            />
          ) : (
            <LocationAutocompleteV3
              value={selectedLocation?.name || ""}
              placeholder="Search locations..."
              onLocationSelect={handleLocationSelect}
              onClear={() => setSelectedLocation(null)}
            />
          )}
          {searchMode === "content" && searchQuery.length > 0 && (
            <Pressable onPress={handleClear}>
              <X size={20} color="#999" />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={toggleSearchMode}
          className="bg-secondary rounded-lg p-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {searchMode === "content" ? (
            <MapPin size={18} color="#3FDCFF" />
          ) : (
            <Search size={18} color="#3FDCFF" />
          )}
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" keyboardDismissMode="on-drag">
        {searchMode === "location" ? (
          // Location search mode
          <View className="flex-1 p-4">
            <View className="flex-row items-center gap-2 mb-4">
              <MapPin size={20} color="#3FDCFF" />
              <Text className="text-lg font-semibold text-foreground">
                Location Search
              </Text>
            </View>
            <Text className="text-sm text-muted-foreground mb-4">
              Search for locations to find posts from specific places, venues,
              or areas.
            </Text>
            {selectedLocation && (
              <View className="bg-secondary rounded-lg p-4 mb-4">
                <Text className="font-medium text-foreground mb-1">
                  {selectedLocation.name}
                </Text>
                {selectedLocation.formattedAddress && (
                  <Text className="text-sm text-muted-foreground">
                    {selectedLocation.formattedAddress}
                  </Text>
                )}
              </View>
            )}
          </View>
        ) : debouncedSearch.length >= 2 ? (
          // Content search mode
          isSearchLoading && !searchData ? (
            <SearchResultsSkeleton />
          ) : (
            <View className="flex-1">
              {isHashtag ? (
                <>
                  <View className="p-4 border-b border-border">
                    <View className="flex-row items-center gap-2">
                      <Hash size={20} color="#fff" />
                      <Text className="text-lg font-semibold text-foreground">
                        {searchQuery}
                      </Text>
                    </View>
                    <Text className="text-sm text-muted-foreground mt-1">
                      {searchResults.length}{" "}
                      {searchResults.length === 1 ? "post" : "posts"}
                    </Text>
                  </View>
                  {searchResults.length > 0 ? (
                    <View className="flex-row flex-wrap">
                      {searchResults.map((post: any) => {
                        return (
                          <PostGridTile
                            key={post.id}
                            post={post}
                            size={columnWidth}
                            router={router}
                            queryClient={queryClient}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <View className="p-8 items-center">
                      <Hash size={48} color="#666" />
                      <Text className="text-muted-foreground mt-4 text-center">
                        No posts found for {searchQuery}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {userResults.length > 0 && (
                    <View className="p-4 border-b border-border">
                      <Text className="text-base font-semibold text-foreground mb-3">
                        Users
                      </Text>
                      {userResults.map((user: any) => (
                        <Pressable
                          key={user.id}
                          onPress={() =>
                            router.push({
                              pathname: "/(protected)/profile/[username]",
                              params: {
                                username: user.username,
                                authId: user.authId || user.id,
                                avatar: user.avatar || "",
                                name: user.name || "",
                              },
                            })
                          }
                          className="flex-row items-center py-3 border-b border-border"
                        >
                          <Avatar
                            uri={user.avatar}
                            username={user.username || "User"}
                            size="md"
                            variant="circle"
                          />
                          <View className="ml-3 flex-1">
                            <Text className="font-semibold text-foreground">
                              {user.username}
                            </Text>
                            {user.name && (
                              <Text className="text-muted-foreground text-[13px]">
                                {user.name}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {searchResults.length > 0 && (
                    <View className="p-4">
                      <Text className="text-base font-semibold text-foreground mb-3">
                        Posts
                      </Text>
                      <View className="flex-row flex-wrap">
                        {searchResults.map((post: any) => {
                          return (
                            <PostGridTile
                              key={post.id}
                              post={post}
                              size={columnWidth}
                              router={router}
                              queryClient={queryClient}
                            />
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {userResults.length === 0 && searchResults.length === 0 && (
                    <View className="p-8 items-center">
                      <Search size={48} color="#666" />
                      <Text className="text-muted-foreground mt-4 text-center">
                        No results found for "{debouncedSearch}"
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )
        ) : isDiscoverLoading && !discoverData ? (
          <SearchSkeleton />
        ) : (
          <>
            <DiscoverSection users={discoverData?.users ?? []} />
            <DiscoverGrid
              router={router}
              posts={discoverPosts}
              queryClient={queryClient}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  return (
    <ErrorBoundary screenName="Search" onGoBack={() => router.back()}>
      <SearchScreenContent />
    </ErrorBoundary>
  );
}
