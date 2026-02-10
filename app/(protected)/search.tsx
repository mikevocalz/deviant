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
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Search, X, Play, Hash } from "lucide-react-native";
import { Image } from "expo-image";
import { useSearchStore } from "@/lib/stores/search-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEffect, useState } from "react";
import { SearchSkeleton, SearchResultsSkeleton } from "@/components/skeletons";
import { useSearchPosts, useSearchUsers } from "@/lib/hooks/use-search";
import { postsApi } from "@/lib/api/posts";
import { usersApi } from "@/lib/api/users";

const { width } = Dimensions.get("window");
const columnWidth = (width - 8) / 3;

export default function SearchScreen() {
  const router = useRouter();
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
          <Pressable onPress={() => router.back()}>
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
        <ScrollView className="flex-1">
          {isLoading ? (
            <SearchSkeleton />
          ) : searchQuery.length === 0 ? (
            <View className="p-4">
              <Text className="text-base font-semibold mb-3 text-foreground">
                Search for posts, users, or hashtags
              </Text>
              <Text className="text-sm text-muted-foreground">
                Try searching for a username, or use # to search for hashtags
              </Text>
            </View>
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
                            style={{ width: columnWidth, height: columnWidth }}
                          >
                            <View className="flex-1 m-px overflow-hidden bg-secondary">
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
                          <Image
                            source={{
                              uri:
                                user.avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "User")}`,
                            }}
                            className="w-11 h-11 rounded-full"
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
                              }}
                            >
                              <View className="flex-1 m-px overflow-hidden bg-secondary">
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
