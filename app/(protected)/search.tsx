import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Search, X, Play, Hash, Compass } from "lucide-react-native";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui/avatar";
import { useSearchStore } from "@/lib/stores/search-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffect, useState, useCallback, useMemo } from "react";
import { SearchSkeleton, SearchResultsSkeleton } from "@/components/skeletons";
import { useSearchPosts, useSearchUsers } from "@/lib/hooks/use-search";
import { postsApi } from "@/lib/api/posts";
import { usersApi } from "@/lib/api/users";
import { BadgeCheck, UserPlus } from "lucide-react-native";
import { LegendList } from "@/components/list";
import type { Post } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const columnWidth = (SCREEN_WIDTH - 8) / 3;
const GRID_COLS = SCREEN_WIDTH >= 768 ? 5 : 4;
const GRID_GAP = 2;
const GRID_CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

interface DiscoverUser {
  id: string;
  username: string;
  name: string;
  avatar: string;
  verified: boolean;
  bio: string;
  postsCount: number;
}

function DiscoverSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const newest = await usersApi.getNewestUsers(15);
      setUsers(newest);
      setLoading(false);
    })();
  }, []);

  return (
    <View className="py-4">
      <View className="flex-row items-center gap-2 px-4 mb-4">
        <UserPlus size={20} color="#3FDCFF" />
        <Text className="text-lg font-bold text-foreground">
          Discover New Profiles
        </Text>
      </View>

      {loading ? (
        <View className="flex-row gap-3 px-4">
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              className="w-[140px] h-[180px] rounded-2xl bg-secondary"
            />
          ))}
        </View>
      ) : users.length === 0 ? (
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

function DiscoverGrid({ router }: { router: ReturnType<typeof useRouter> }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const explore = await postsApi.getExplorePosts(40);
      setPosts(explore);
      setLoading(false);
    })();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      const isVideo = item.type === "video";
      const uri = item.thumbnail || item.media?.[0]?.url;
      return (
        <Pressable
          onPress={() => router.push(`/(protected)/post/${item.id}`)}
          style={{
            width: GRID_CELL_SIZE,
            height: GRID_CELL_SIZE,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {uri ? (
            <>
              <Image
                source={{ uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
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
              <Text style={{ color: "#666", fontSize: 10 }}>No media</Text>
            </View>
          )}
        </Pressable>
      );
    },
    [router],
  );

  if (loading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: "center" }}>
        <ActivityIndicator size="small" color="#3FDCFF" />
      </View>
    );
  }

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
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ query?: string }>();
  const {
    searchQuery: storeQuery,
    setSearchQuery,
    clearSearch,
  } = useSearchStore();
  const [searchQuery, setLocalQuery] = useState(
    params.query || storeQuery || "",
  );
  const insets = useSafeAreaInsets();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.search;

  // Use query from params if provided (e.g., when navigating from hashtag)
  useEffect(() => {
    if (params.query) {
      setLocalQuery(params.query);
      setSearchQuery(params.query);
    }
  }, [params.query, setSearchQuery]);

  const { data: postsData, isLoading: isLoadingPosts } =
    useSearchPosts(searchQuery);
  const { data: usersData, isLoading: isLoadingUsers } = useSearchUsers(
    searchQuery.startsWith("#") ? "" : searchQuery,
  );

  const isHashtag = searchQuery.startsWith("#");
  const searchResults = postsData?.docs || [];
  const userResults = usersData?.docs || [];

  useEffect(() => {
    const loadInitial = async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setScreenLoading("search", false);
    };
    loadInitial();
  }, [setScreenLoading]);

  const handleQueryChange = (text: string) => {
    setLocalQuery(text);
    setSearchQuery(text);
  };

  const handleClear = () => {
    setLocalQuery("");
    clearSearch();
  };

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
              autoFocus={!params.query}
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
          {isLoading ? (
            <SearchSkeleton />
          ) : searchQuery.length === 0 ? (
            <>
              <DiscoverSection router={router} />
              <DiscoverGrid router={router} />
            </>
          ) : isLoadingPosts || isLoadingUsers ? (
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
                              `/(protected)/profile/${user.username}` as any,
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
                    </View>
                  )}
                  {userResults.length === 0 && searchResults.length === 0 && (
                    <View className="p-8 items-center">
                      <Search size={48} color="#666" />
                      <Text className="text-muted-foreground mt-4 text-center">
                        No results found for "{searchQuery}"
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
