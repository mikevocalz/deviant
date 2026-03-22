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
import { FeedEventCard } from "./feed-event-card";
import { useInfiniteFeedPosts, useSyncLikedPosts } from "@/lib/hooks/use-posts";
import { useForYouEvents } from "@/lib/hooks/use-events";
import type { Event } from "@/lib/hooks/use-events";
import { FeedSkeleton } from "@/components/skeletons";
import { useAppStore } from "@/lib/stores/app-store";
import { useMemo, useEffect, useRef, useCallback, memo } from "react";
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
import { storyKeys } from "@/lib/hooks/use-stories";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import {
  prefetchImages,
  extractFeedImageUrls,
} from "@/lib/perf/image-prefetch";
import {
  useLikesSheet,
  fireLikesTap,
} from "@/src/features/likes/LikesSheetController";
import { CommentsSheet } from "@/components/comments-sheet";
import { PostActionSheet } from "@/components/post-action-sheet";
import { ShareToInboxSheet } from "@/components/share-to-inbox-sheet";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useDeletePost } from "@/lib/hooks/use-posts";
import { sharePost } from "@/lib/utils/sharing";
import { useCreateStory, useStories } from "@/lib/hooks/use-stories";
import { useUIStore } from "@/lib/stores/ui-store";

type FeedPostItem = { _type: "post"; data: Post };
type FeedEventItem = { _type: "event"; data: Event };
type FeedItem = FeedPostItem | FeedEventItem;

const EVENT_INTERVAL = 7;

const REFRESH_COLORS = ["#34A2DF", "#8A40CF", "#FF5BFC"];

const FALLBACK_AUTHOR = {
  id: undefined,
  username: "unknown",
  avatar: "",
} as const;
const EMPTY_MEDIA: import("@/lib/types").PostMediaItem[] = [];

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
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const deletePostMutation = useDeletePost();
  const createStoryMutation = useCreateStory();

  // Likes sheet — centralized controller at app root, no per-screen instance
  // FeedPost now calls useLikesSheet() directly; handleShowLikes kept as fallback for onShowLikes prop
  const { open: openLikesSheet } = useLikesSheet();
  const handleShowLikes = useCallback(
    (postId: string) => {
      fireLikesTap(postId, openLikesSheet);
    },
    [openLikesSheet],
  );

  // ── Lifted sheets (rendered outside FlatList to avoid cell clipping) ──
  const actionSheetPostId = useFeedPostUIStore((s) => s.actionSheetPostId);
  const shareSheetPostId = useFeedPostUIStore((s) => s.shareSheetPostId);
  const commentsSheetPostId = useFeedPostUIStore((s) => s.commentsSheetPostId);
  const setActionSheetPostId = useFeedPostUIStore(
    (s) => s.setActionSheetPostId,
  );
  const setShareSheetPostId = useFeedPostUIStore((s) => s.setShareSheetPostId);
  const setCommentsSheetPostId = useFeedPostUIStore(
    (s) => s.setCommentsSheetPostId,
  );

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

  // Gate: stories must be ready before revealing the feed (prevents waterfall)
  // isPending = no data at all (cache miss + loading). With MMKV persistence,
  // this is only true on first-ever launch. Errors also clear the gate.
  const { isPending: storiesPending } = useStories();

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

  // Fetch events for inline feed cards
  const { data: forYouEvents } = useForYouEvents();

  // Interleave event cards every EVENT_INTERVAL posts
  const feedItems: FeedItem[] = useMemo(() => {
    const events = forYouEvents ?? [];
    const items: FeedItem[] = [];
    let eventIdx = 0;
    for (let i = 0; i < filteredPosts.length; i++) {
      items.push({ _type: "post", data: filteredPosts[i] });
      if ((i + 1) % EVENT_INTERVAL === 0 && eventIdx < events.length) {
        items.push({ _type: "event", data: events[eventIdx] });
        eventIdx++;
      }
    }
    return items;
  }, [filteredPosts, forYouEvents]);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
      if (item._type === "event") {
        return <FeedEventCard event={item.data} />;
      }
      return (
        <AnimatedFeedPost
          item={item.data}
          index={index}
          onShowLikes={handleShowLikes}
        />
      );
    },
    [handleShowLikes],
  );

  const keyExtractor = useCallback((item: FeedItem, index: number) => {
    if (item._type === "event") return `feed-event-${item.data.id}`;
    return item.data?.id || `post-${index}`;
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    // Refetch feed posts AND stories on pull-to-refresh
    queryClient.invalidateQueries({ queryKey: storyKeys.list() });
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
      viewableItems: { item: FeedItem; isViewable: boolean }[];
    }) => {
      if (viewableItems.length > 0) {
        // Find first viewable post (skip event cards for active post tracking)
        const firstPost = viewableItems.find(
          (v) => v.isViewable && v.item._type === "post",
        );
        if (firstPost && firstPost.item._type === "post") {
          setActivePostId(firstPost.item.data.id);
        }
        // Eager prefetch comments for newly visible posts
        viewableItems.forEach(({ item }) => {
          if (
            item._type === "post" &&
            item.data?.id &&
            !prefetchedComments.has(item.data.id)
          ) {
            prefetchedComments.add(item.data.id);
            prefetchComments(queryClient, item.data.id);
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

  // Only show empty state if we're definitely not loading and have no data
  const shouldShowEmptyState =
    !isLoading &&
    !storiesPending &&
    nsfwLoaded &&
    allPosts.length === 0 &&
    !error;

  const actionPost = useMemo(
    () =>
      actionSheetPostId
        ? allPosts.find((p) => p.id === actionSheetPostId)
        : undefined,
    [actionSheetPostId, allPosts],
  );

  const sharePost_ = useMemo(
    () =>
      shareSheetPostId
        ? allPosts.find((p) => p.id === shareSheetPostId)
        : undefined,
    [shareSheetPostId, allPosts],
  );

  const currentUsername = useAuthStore((s) => s.user?.username);
  const actionIsOwner = actionPost?.author?.username === currentUsername;

  const handleActionEdit = useCallback(() => {
    if (actionSheetPostId)
      router.push(`/(protected)/edit-post/${actionSheetPostId}`);
    setActionSheetPostId(null);
  }, [actionSheetPostId, router, setActionSheetPostId]);

  const handleActionDelete = useCallback(() => {
    if (!actionSheetPostId) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePostMutation.mutate(actionSheetPostId, {
            onSuccess: () => showToast("success", "Deleted", "Post deleted"),
            onError: () => showToast("error", "Error", "Failed to delete post"),
          });
          setActionSheetPostId(null);
        },
      },
    ]);
  }, [actionSheetPostId, deletePostMutation, showToast, setActionSheetPostId]);

  const handleActionShare = useCallback(async () => {
    if (actionPost) {
      try {
        await sharePost(actionPost.id, actionPost.caption);
      } catch {}
    }
    setActionSheetPostId(null);
  }, [actionPost, setActionSheetPostId]);

  const handleActionShareToStory = useCallback(async () => {
    const media = actionPost?.media?.[0];
    if (!media?.url) {
      showToast("error", "Error", "This post has no media to share");
      return;
    }
    try {
      await createStoryMutation.mutateAsync({
        items: [{ type: media.type || "image", url: media.url }],
      });
      showToast("success", "Shared", "Post shared to your story!");
    } catch {
      showToast("error", "Error", "Failed to share to story");
    }
    setActionSheetPostId(null);
  }, [actionPost, createStoryMutation, showToast, setActionSheetPostId]);

  // Simple loading state - only show skeleton during initial load
  const isActuallyLoading = isLoading || storiesPending || !nsfwLoaded;

  useEffect(() => {
    console.log("[Feed] Loading state changed:", {
      isLoading,
      storiesPending,
      nsfwLoaded,
      hasData: !!data,
      allPostsLength: allPosts.length,
      isActuallyLoading,
    });
  }, [
    isLoading,
    storiesPending,
    nsfwLoaded,
    data,
    allPosts.length,
    isActuallyLoading,
  ]);

  if (isActuallyLoading) {
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
        data={feedItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          feedItems.length === 0
            ? { flex: 1, paddingBottom: 80 }
            : { paddingBottom: 80 }
        }
        showsVerticalScrollIndicator={false}
        recycleItems
        estimatedItemSize={500}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={() => (
          <>
            <View style={{ height: 40 }} />
            <StoriesBar />
          </>
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={shouldShowEmptyState ? ListEmpty : undefined}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
      />

      {/* Sheets lifted from FeedPost — rendered outside FlatList so they aren't clipped by cell boundaries */}
      <CommentsSheet
        visible={!!commentsSheetPostId}
        onClose={() => setCommentsSheetPostId(null)}
        postId={commentsSheetPostId}
      />

      <PostActionSheet
        visible={!!actionSheetPostId}
        onClose={() => setActionSheetPostId(null)}
        isOwner={actionIsOwner}
        onEdit={handleActionEdit}
        onDelete={handleActionDelete}
        onShareToStory={handleActionShareToStory}
        onShare={handleActionShare}
      />

      <ShareToInboxSheet
        visible={!!shareSheetPostId}
        onClose={() => setShareSheetPostId(null)}
        post={
          sharePost_
            ? {
                id: sharePost_.id,
                authorUsername: sharePost_.author?.username || "",
                authorAvatar: sharePost_.author?.avatar || "",
                caption: sharePost_.caption,
                mediaUrl: sharePost_.media?.[0]?.url,
                mediaType: sharePost_.media?.[0]?.type,
              }
            : null
        }
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
