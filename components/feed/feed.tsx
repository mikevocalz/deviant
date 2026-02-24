import {
  View,
  Text,
  Platform,
  RefreshControl,
  StyleSheet,
  Animated as RNAnimated,
} from "react-native";
import { LegendList } from "@/components/list";
import type { LegendListRef } from "@/components/list";
import { FeedPost } from "./feed-post";
import { useInfiniteFeedPosts, useSyncLikedPosts } from "@/lib/hooks/use-posts";
import { FeedSkeleton } from "@/components/skeletons";
import { useAppStore } from "@/lib/stores/app-store";
import { useMemo, useEffect, useRef, useCallback, memo, useState } from "react";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import { StoriesBar } from "@/components/stories/stories-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageOff } from "lucide-react-native";
import type { Post } from "@/lib/types";
import { useBookmarks } from "@/lib/hooks/use-bookmarks";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { seedLikeState } from "@/lib/hooks/usePostLikeState";
import { prefetchComments } from "@/lib/hooks/use-comments";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";
import { useBootstrapFeed } from "@/lib/hooks/use-bootstrap-feed";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import {
  prefetchImages,
  extractFeedImageUrls,
} from "@/lib/perf/image-prefetch";
import { LikesSheet } from "@/src/features/posts/likes/LikesSheet";

const REFRESH_COLORS = ["#34A2DF", "#8A40CF", "#FF5BFC"];

const FALLBACK_AUTHOR = {
  id: undefined,
  username: "unknown",
  avatar: "",
} as const;
const EMPTY_MEDIA: { type: string; url: string }[] = [];

const AnimatedFeedPost = memo(function AnimatedFeedPost({
  item,
  onShowLikes,
}: {
  item: Post;
  index: number;
  onShowLikes?: (postId: string) => void;
}) {
  return (
    <View style={{ paddingVertical: 12 }}>
      <FeedPost
        id={item.id || ""}
        author={item.author || FALLBACK_AUTHOR}
        media={item.media || EMPTY_MEDIA}
        caption={item.caption || ""}
        likes={item.likes || 0}
        viewerHasLiked={item.viewerHasLiked || false}
        comments={item.comments || 0}
        timeAgo={item.timeAgo || ""}
        location={item.location}
        isNSFW={item.isNSFW}
        onShowLikes={onShowLikes}
      />
    </View>
  );
});

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
  // Likes sheet state — ONE instance at feed level, not per-post
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const handleShowLikes = useCallback((postId: string) => {
    setLikesPostId(postId);
  }, []);
  const handleCloseLikes = useCallback(() => {
    setLikesPostId(null);
  }, []);

  // Perf: Bootstrap hydrates the TanStack cache BEFORE individual queries run.
  // When perf_bootstrap_feed flag is ON, a single edge function call populates
  // the feed cache, so useInfiniteFeedPosts returns data instantly from cache.
  useBootstrapFeed();
  const trace = useScreenTrace("Feed");

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

  // CRITICAL: Get queryClient and viewerId for seeding likeState cache
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((state) => state.user?.id) || "";

  // Sync liked posts from server to Zustand store on mount
  useSyncLikedPosts();
  useBookmarks();

  const { nsfwEnabled, loadNsfwSetting, nsfwLoaded } = useAppStore();
  const { setActivePostId } = useFeedPostUIStore();
  const prevNsfwEnabled = useRef(nsfwEnabled);
  const listRef = useRef<LegendListRef>(null);
  const scrollToTopTrigger = useFeedScrollStore((s) => s.scrollToTopTrigger);

  useEffect(() => {
    if (scrollToTopTrigger > 0 && listRef.current) {
      listRef.current.scrollToOffset?.({ offset: 0, animated: true });
    }
  }, [scrollToTopTrigger]);

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

  // Perf: Mark TTUC when first posts are visible + prefetch off-screen images + comments
  useEffect(() => {
    if (allPosts.length > 0) {
      if (trace.elapsed() < 50) trace.markCacheHit();
      trace.markUsable();
      // Prefetch images for posts below the fold (posts 4+)
      const offScreenPosts = allPosts.slice(3);
      if (offScreenPosts.length > 0) {
        const urls = extractFeedImageUrls(offScreenPosts);
        prefetchImages(urls);
      }
      // Eager prefetch comments for first 5 posts — data in cache before user taps
      allPosts.slice(0, 5).forEach((post) => {
        if (post?.id) prefetchComments(queryClient, post.id);
      });
    }
  }, [allPosts.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRITICAL: Seed like states from feed data
  // The custom /api/posts/feed endpoint now returns isLiked and likesCount per post
  // No need for separate API calls - just seed the cache from the feed data
  useEffect(() => {
    if (!viewerId || !allPosts.length) return;

    if (__DEV__) {
      console.log(
        `[Feed] Seeding like states for ${allPosts.length} posts from feed data`,
      );
    }

    // Seed the cache with like states from the feed response
    allPosts
      .filter((post) => post?.id)
      .forEach((post) => {
        // viewerHasLiked comes from isLiked in the feed response
        const hasLiked = post.viewerHasLiked === true;
        const likesCount = post.likes || 0;

        seedLikeState(queryClient, viewerId, post.id, hasLiked, likesCount);
      });

    if (__DEV__) {
      const withLikes = allPosts.filter((p) => (p.likes || 0) > 0);
      const withViewerLiked = allPosts.filter((p) => p.viewerHasLiked);
      console.log(
        `[Feed] Seeded ${allPosts.length} like states: ${withLikes.length} have likes, ${withViewerLiked.length} viewer liked`,
      );
    }
  }, [allPosts, viewerId, queryClient]);

  const filteredPosts = useMemo(() => {
    if (nsfwEnabled) return allPosts;
    return allPosts.filter((post) => !post.isNSFW);
  }, [allPosts, nsfwEnabled]);

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <AnimatedFeedPost
        item={item}
        index={index}
        onShowLikes={handleShowLikes}
      />
    ),
    [handleShowLikes],
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
    // Refetch feed posts AND stories on pull-to-refresh
    queryClient.invalidateQueries({ queryKey: ["stories"] });
    await refetch();
  }, [refetch, queryClient]);

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

  // Track which posts we've already prefetched comments for
  const prefetchedComments = useRef(new Set<string>()).current;

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
        // Eager prefetch comments for newly visible posts
        viewableItems.forEach(({ item }) => {
          if (item?.id && !prefetchedComments.has(item.id)) {
            prefetchedComments.add(item.id);
            prefetchComments(queryClient, item.id);
          }
        });
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
    <>
      <LegendList
        ref={listRef}
        data={filteredPosts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          filteredPosts.length === 0
            ? { flex: 1, paddingBottom: 80 }
            : { paddingBottom: 80 }
        }
        showsVerticalScrollIndicator={false}
        recycleItems
        estimatedItemSize={500}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={StoriesBar}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={ListEmpty}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
      />
      <LikesSheet
        postId={likesPostId || ""}
        isOpen={!!likesPostId}
        onClose={handleCloseLikes}
      />
    </>
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
