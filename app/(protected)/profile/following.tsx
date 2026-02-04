import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Search, X } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/supabase-users";
import { UserAvatar } from "@/components/ui/avatar";
import { useFollow } from "@/lib/hooks/use-follow";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Motion } from "@legendapp/motion";
import { memo, useCallback, useState, useMemo } from "react";

interface FollowingUser {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  isFollowing?: boolean;
}

// Individual following row component
const FollowingRow = memo(function FollowingRow({
  user,
  onPress,
  onFollowPress,
  isFollowPending,
  isCurrentUser,
}: {
  user: FollowingUser;
  onPress: () => void;
  onFollowPress: () => void;
  isFollowPending: boolean;
  isCurrentUser: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-muted/50"
    >
      {/* Rounded-square avatar */}
      <UserAvatar
        uri={user.avatar}
        username={user.username}
        size="md"
        variant="roundedSquare"
      />
      {/* Two-line text */}
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-foreground">
          {user.username}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {user.name || user.username}
        </Text>
      </View>
      {/* Follow/Following button */}
      {!isCurrentUser && (
        <Pressable
          onPress={onFollowPress}
          disabled={isFollowPending}
          hitSlop={8}
        >
          <Motion.View
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", damping: 15, stiffness: 400 }}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor:
                user.isFollowing !== false ? "#262626" : "#3EA4E5",
              borderWidth: user.isFollowing !== false ? 1 : 0,
              borderColor: "#404040",
              opacity: isFollowPending ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#fff",
              }}
            >
              {user.isFollowing !== false ? "Following" : "Follow"}
            </Text>
          </Motion.View>
        </Pressable>
      )}
    </Pressable>
  );
});

export default function FollowingScreen() {
  const { userId, username } = useLocalSearchParams<{
    userId?: string;
    username?: string;
  }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { mutate: followMutate, isPending: isFollowPending } = useFollow();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch following list with infinite query for pagination
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["users", "following", userId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!userId) return { users: [], nextPage: null };
      const result = await usersApi.getFollowing(userId, pageParam);
      // Mark all as following since this is the "following" list
      const usersWithFollowing = (result.docs || []).map((u: any) => ({
        ...u,
        isFollowing: true,
      }));
      return {
        users: usersWithFollowing,
        nextPage: result.hasNextPage ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!userId,
  });

  // Flatten pages into single array
  const following = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.users);
  }, [data]);

  // Filter by search query
  const filteredFollowing = useMemo(() => {
    if (!searchQuery.trim()) return following;
    const query = searchQuery.toLowerCase();
    return following.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        (user.name && user.name.toLowerCase().includes(query)),
    );
  }, [following, searchQuery]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    // CRITICAL: Only invalidate specific profile queries, NOT broad ["users"]
    queryClient.invalidateQueries({ queryKey: ["authUser"] });
    setIsRefreshing(false);
  }, [refetch, queryClient]);

  const handleUserPress = useCallback(
    (user: FollowingUser) => {
      router.push(`/(protected)/profile/${user.username}`);
    },
    [router],
  );

  const handleFollowPress = useCallback(
    (user: FollowingUser) => {
      if (!user.id) return;
      const action = user.isFollowing !== false ? "unfollow" : "follow";
      followMutate({
        userId: user.id,
        action,
        username: user.username,
      });
    },
    [followMutate],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: FollowingUser }) => (
      <FollowingRow
        user={item}
        onPress={() => handleUserPress(item)}
        onFollowPress={() => handleFollowPress(item)}
        isFollowPending={isFollowPending}
        isCurrentUser={currentUser?.id === item.id}
      />
    ),
    [handleUserPress, handleFollowPress, isFollowPending, currentUser?.id],
  );

  const renderSeparator = useCallback(
    () => (
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginLeft: 64,
        }}
      />
    ),
    [colors.border],
  );

  const renderEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-muted-foreground text-center">
          {searchQuery ? "No results found" : "Not following anyone yet"}
        </Text>
      </View>
    ),
    [searchQuery],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, colors.primary]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-foreground">
          Following
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search bar */}
      <View className="px-4 py-2 border-b border-border">
        <View className="flex-row items-center bg-muted rounded-lg px-3 py-2">
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor={colors.mutedForeground}
            className="flex-1 ml-2 text-foreground"
            style={{ fontSize: 16 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <X size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center mb-4">
            Failed to load following
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="text-primary font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={filteredFollowing}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          estimatedItemSize={72}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
