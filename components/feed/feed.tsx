import {
  FlatList,
  View,
  Text,
  Platform,
  RefreshControl,
  StyleSheet,
  Animated as RNAnimated,
  Pressable,
} from "react-native";
import { FeedPost } from "./feed-post";
import { useInfiniteFeedPosts, useSyncLikedPosts } from "@/lib/hooks/use-posts";
import { FeedSkeleton } from "@/components/skeletons";
import { useAppStore } from "@/lib/stores/app-store";
import { useMemo, useEffect, useRef, useCallback } from "react";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import { Motion } from "@legendapp/motion";
import { useRouter } from "expo-router";
import { StoriesBar } from "@/components/stories/stories-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageOff } from "lucide-react-native";
import type { Post } from "@/lib/types";

const REFRESH_COLORS = ["#34A2DF", "#8A40CF", "#FF5BFC"];

function AnimatedFeedPost({ item, index }: { item: Post; index: number }) {
  const router = useRouter();

  return (
    <Motion.View
      className="px-0 py-3"
      initial={{ opacity: 0, scale: 0.9, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 100,
        delay: index * 0.1,
      }}
    >
      <Pressable
        onPress={() => {
          if (item?.id) {
            router.push(`/(protected)/post/${item.id}`);
          }
        }}
        className="rounded-2xl"
      >
        <FeedPost
          id={item.id || ""}
          author={item.author || { username: "unknown", avatar: "" }}
          media={item.media || []}
          caption={item.caption || ""}
          likes={item.likes || 0}
          comments={0}
          timeAgo={item.timeAgo || ""}
          location={item.location}
          isNSFW={item.isNSFW}
        />
      </Pressable>
    </Motion.View>
  );
}

function LoadMoreIndicator() {
  return (
    <View style={styles.loadMoreContainer}>
      <View style={styles.loadMoreDots}>
        <View
          style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[0] }]}
        />
        <View
          style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[1] }]}
        />
        <View
          style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[2] }]}
        />
      </View>
    </View>
  );
}

function GradientRefreshIndicator({ refreshing }: { refreshing: boolean }) {
  const dot1Anim = useRef(new RNAnimated.Value(0)).current;
  const dot2Anim = useRef(new RNAnimated.Value(0)).current;
  const dot3Anim = useRef(new RNAnimated.Value(0)).current;
  const animationRef = useRef<RNAnimated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (refreshing) {
      animationRef.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(dot1Anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot2Anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot3Anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot1Anim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot2Anim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot3Anim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      );
      animationRef.current.start();
    } else {
      animationRef.current?.stop();
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
    }
    return () => {
      animationRef.current?.stop();
    };
  }, [refreshing, dot1Anim, dot2Anim, dot3Anim]);

  const dot1Scale = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const dot2Scale = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const dot3Scale = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  return (
    <View style={styles.gradientRefreshContainer}>
      <RNAnimated.View
        style={[
          styles.gradientDot,
          {
            backgroundColor: REFRESH_COLORS[0],
            transform: [{ scale: dot1Scale }],
          },
        ]}
      />
      <RNAnimated.View
        style={[
          styles.gradientDot,
          {
            backgroundColor: REFRESH_COLORS[1],
            transform: [{ scale: dot2Scale }],
          },
        ]}
      />
      <RNAnimated.View
        style={[
          styles.gradientDot,
          {
            backgroundColor: REFRESH_COLORS[2],
            transform: [{ scale: dot3Scale }],
          },
        ]}
      />
    </View>
  );
}

export function Feed() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteFeedPosts();

  // Sync liked posts from server to Zustand store on mount
  useSyncLikedPosts();

  const { nsfwEnabled, loadNsfwSetting, nsfwLoaded } = useAppStore();
  const { setActivePostId } = useFeedPostUIStore();
  const prevNsfwEnabled = useRef(nsfwEnabled);

  useEffect(() => {
    loadNsfwSetting();
  }, [loadNsfwSetting]);

  useEffect(() => {
    prevNsfwEnabled.current = nsfwEnabled;
  }, [nsfwEnabled]);

  const allPosts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  const filteredPosts = useMemo(() => {
    if (nsfwEnabled) return allPosts;
    return allPosts.filter((post) => !post.isNSFW);
  }, [allPosts, nsfwEnabled]);

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <AnimatedFeedPost item={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: Post, index: number) => item?.id || `post-${index}`,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return <LoadMoreIndicator />;
  }, [isFetchingNextPage]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 50,
  }).current;

  // Track if we've set the initial active post for this feed load
  const hasSetInitialPost = useRef(false);

  // Set first post as active when feed loads (for video autoplay)
  useEffect(() => {
    // Reset the flag when posts change (e.g., after refresh)
    if (filteredPosts.length === 0) {
      hasSetInitialPost.current = false;
      return;
    }

    // Only set initial post once per feed load
    if (!hasSetInitialPost.current && filteredPosts.length > 0) {
      hasSetInitialPost.current = true;
      // Always set the first post as active for autoplay
      setActivePostId(filteredPosts[0].id);
    }
  }, [filteredPosts, setActivePostId]);

  // Reset the flag when component unmounts or data is refetched
  useEffect(() => {
    if (isRefetching) {
      hasSetInitialPost.current = false;
    }
  }, [isRefetching]);

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { item: Post; isViewable: boolean }[];
    }) => {
      if (viewableItems.length > 0) {
        const firstViewable = viewableItems[0];
        if (firstViewable?.isViewable && firstViewable?.item?.id) {
          setActivePostId(firstViewable.item.id);
        }
      } else {
        setActivePostId(null);
      }
    },
  ).current;

  const ListEmpty = useCallback(
    () => (
      <EmptyState
        icon={ImageOff}
        title="No Posts Yet"
        description="When you or people you follow share posts, they'll appear here"
      />
    ),
    [],
  );

  if (isLoading || !nsfwLoaded) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center pb-20">
        <Text className="text-destructive">Failed to load posts</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredPosts}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerClassName="pb-20"
      contentContainerStyle={
        filteredPosts.length === 0 ? { flex: 1 } : undefined
      }
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={StoriesBar}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={ListEmpty}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={Platform.OS === "ios" ? "transparent" : REFRESH_COLORS[1]}
          colors={REFRESH_COLORS}
          progressBackgroundColor="#ffffff"
        >
          {Platform.OS === "ios" && (
            <GradientRefreshIndicator refreshing={isRefetching} />
          )}
        </RefreshControl>
      }
    />
  );
}

const styles = StyleSheet.create({
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreDots: {
    flexDirection: "row",
    gap: 8,
  },
  loadMoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gradientRefreshContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 40,
  },
  gradientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
