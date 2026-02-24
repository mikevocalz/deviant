import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Dimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Search, X, Play, Hash, Compass } from "lucide-react-native";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui/avatar";
import { useSearchStore } from "@/lib/stores/search-store";
import { useEffect, useCallback, useRef } from "react";
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
import { screenPrefetch } from "@/lib/prefetch";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const columnWidth = (SCREEN_WIDTH - 8) / 3;
const GRID_COLS = SCREEN_WIDTH >= 768 ? 5 : 4;
const GRID_GAP = 2;
const GRID_CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

function DiscoverSection({
  router,
  users,
}: {
  router: ReturnType<typeof useRouter>;
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
                `/(protected)/profile/${user.username}?authId=${user.id}` as any
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
      const isVideo = item.type === "video";
      const videoUrl = isVideo ? item.media?.[0]?.url : undefined;
      // For video posts, NEVER use the video URL as image source — expo-image can't render it
      const imageUri =
        item.thumbnail || (!isVideo ? item.media?.[0]?.url : undefined);
      return (
        <Pressable
          onPress={() => {
            screenPrefetch.postDetail(queryClient, item.id);
            router.push(`/(protected)/post/${item.id}`);
          }}
          style={{
            width: GRID_CELL_SIZE,
            height: GRID_CELL_SIZE,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              {isVideo && (
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                  }}
                >
                  <Play size={16} color="#fff" fill="#fff" />
                </View>
              )}
              {item.hasMultipleImages && (
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
              )}
            </>
          ) : isVideo && videoUrl ? (
            <>
              <VideoThumbnailImage videoUrl={videoUrl} />
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                }}
              >
                <Play size={16} color="#fff" fill="#fff" />
              </View>
            </>
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
              <Text style={{ color: "#444", fontSize: 10 }}>Aa</Text>
            </View>
          )}
        </Pressable>
      );
    },
    [router],
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

export default function SearchScreen() {
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

  // Simple setTimeout debounce — 300ms delay prevents query-per-keystroke
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const searchResults = searchData?.posts?.docs || [];
  const userResults = searchData?.users?.docs || [];

  const handleQueryChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearch(text);
      }, 300);
    },
    [setSearchQuery, setDebouncedSearch],
  );

  const handleClear = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    clearSearch();
  }, [clearSearch]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
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
            <Search size={20} color="#999" />
            <TextInput
              value={searchQuery}
              onChangeText={handleQueryChange}
              placeholder={isHashtag ? "Search hashtags..." : "Search"}
              placeholderTextColor="#999"
              autoFocus={false}
              className="flex-1 h-10 ml-2 text-foreground"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClear}>
                <X size={20} color="#999" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Content */}
        <ScrollView className="flex-1" keyboardDismissMode="on-drag">
          {debouncedSearch.length >= 2 ? (
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
                          const firstMedia = post.media?.[0];
                          const thumbnail = firstMedia?.url;
                          const isVideo = firstMedia?.type === "video";

                          return (
                            <Pressable
                              key={post.id}
                              onPress={() => {
                                if (post?.id) {
                                  screenPrefetch.postDetail(
                                    queryClient,
                                    post.id,
                                  );
                                  router.push(`/(protected)/post/${post.id}`);
                                }
                              }}
                              style={{
                                width: columnWidth,
                                height: columnWidth,
                                padding: 1,
                              }}
                            >
                              <View
                                className="flex-1 overflow-hidden bg-secondary"
                                style={{ borderRadius: 8 }}
                              >
                                {thumbnail &&
                                (thumbnail.startsWith("http://") ||
                                  thumbnail.startsWith("https://")) ? (
                                  <>
                                    <Image
                                      source={{ uri: thumbnail }}
                                      style={{ width: "100%", height: "100%" }}
                                      contentFit="cover"
                                    />
                                    {isVideo && (
                                      <View className="absolute top-2 right-2">
                                        <Play
                                          size={20}
                                          color="#fff"
                                          fill="#fff"
                                        />
                                      </View>
                                    )}
                                  </>
                                ) : (
                                  <View className="w-full h-full items-center justify-center">
                                    <Text className="text-muted-foreground text-xs">
                                      No media
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </Pressable>
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
                              router.push(
                                `/(protected)/profile/${user.username}?authId=${user.id}` as any,
                              )
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
                            const firstMedia = post.media?.[0];
                            const thumbnail = firstMedia?.url;
                            const isVideo = firstMedia?.type === "video";

                            return (
                              <Pressable
                                key={post.id}
                                onPress={() => {
                                  if (post?.id) {
                                    screenPrefetch.postDetail(
                                      queryClient,
                                      post.id,
                                    );
                                    router.push(`/(protected)/post/${post.id}`);
                                  }
                                }}
                                style={{
                                  width: columnWidth,
                                  height: columnWidth,
                                  padding: 1,
                                }}
                              >
                                <View
                                  className="flex-1 overflow-hidden bg-secondary"
                                  style={{ borderRadius: 8 }}
                                >
                                  {thumbnail &&
                                  (thumbnail.startsWith("http://") ||
                                    thumbnail.startsWith("https://")) ? (
                                    <>
                                      <Image
                                        source={{ uri: thumbnail }}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                        }}
                                        contentFit="cover"
                                      />
                                      {isVideo && (
                                        <View className="absolute top-2 right-2">
                                          <Play
                                            size={20}
                                            color="#fff"
                                            fill="#fff"
                                          />
                                        </View>
                                      )}
                                    </>
                                  ) : (
                                    <View className="w-full h-full items-center justify-center">
                                      <Text className="text-muted-foreground text-xs">
                                        No media
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </Pressable>
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
              <DiscoverSection
                router={router}
                users={discoverData?.users ?? []}
              />
              <DiscoverGrid
                router={router}
                posts={discoverData?.posts ?? []}
                queryClient={queryClient}
              />
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
