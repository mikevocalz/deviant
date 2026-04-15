/**
 * MasonryFeed
 *
 * Pinterest-style 2-column masonry feed. Each cell shows:
 * - Post image/video thumbnail
 * - Bottom overlay: likes count, bookmark icon, time ago
 *
 * Event cards are interleaved every EVENT_INTERVAL posts, full-width,
 * identical to the classic feed event cards.
 *
 * Uses the same data hooks as the classic Feed — just a different view.
 */
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useMemo, useCallback, memo, useEffect, useRef, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Bookmark, Play, Grid3x3 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteFeedPosts, useSyncLikedPosts } from "@/lib/hooks/use-posts";
import { useBookmarks, useToggleBookmark } from "@/lib/hooks/use-bookmarks";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { storyKeys } from "@/lib/hooks/use-stories";
import { useAppStore } from "@/lib/stores/app-store";

import { useAuthStore } from "@/lib/stores/auth-store";
import { useBootstrapFeed } from "@/lib/hooks/use-bootstrap-feed";
import { FeedSkeleton } from "@/components/skeletons";
import { StoriesBar } from "@/components/stories/stories-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageOff } from "lucide-react-native";
import { seedLikeState, usePostLikeState } from "@/lib/hooks/usePostLikeState";
import { navigateToPost } from "@/lib/routes/post-routes";
import { getVideoThumbnail } from "@/lib/media/getVideoThumbnail";
import { useQuery } from "@tanstack/react-query";
import { DVNTMediaBadge } from "@/components/media/DVNTMediaBadge";
import { FeedEventCard } from "./feed-event-card";
import { shouldRenderInFeed } from "./renderable-posts";
import { useForYouEvents } from "@/lib/hooks/use-events";
import type { Event } from "@/lib/hooks/use-events";
import type { Post } from "@/lib/types";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";
import * as Haptics from "expo-haptics";
import { TextPostSurface } from "@/components/post/TextPostSurface";
import { resolveTextPostPresentation } from "@/lib/posts/text-post";
import { useStories } from "@/lib/hooks/use-stories";
import {
  extractFeedImageUrls,
  prefetchImages,
  prefetchImagesBlocking,
} from "@/lib/perf/image-prefetch";

// ─── Constants ──────────────────────────────────────────────────────────────

const COLUMN_GAP = 3;
const CELL_RADIUS = 12;
const NUM_COLUMNS = 2;
const VARIATION = 0.3;
const EVENT_INTERVAL = 7;

// ─── Height estimation (deterministic per post) ─────────────────────────────

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

function estimateRatio(post: Post): number {
  const media = post.media?.[0];
  let base = 1.2;
  if (media?.type === "video") base = 1.5;
  else if (post.hasMultipleImages) base = 1.0;
  else if (media?.type === "gif") base = 0.75;
  const offset = (hashId(post.id) * 2 - 1) * VARIATION;
  return base + offset;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Video thumbnail cell ───────────────────────────────────────────────────

const VideoThumb = memo(function VideoThumb({
  videoUrl,
  coverUrl,
  width,
  height,
}: {
  videoUrl: string;
  coverUrl: string | null;
  width: number;
  height: number;
}) {
  const { data: generatedThumb } = useQuery({
    queryKey: ["videoThumb", videoUrl],
    queryFn: () => getVideoThumbnail(videoUrl),
    enabled: !coverUrl && Boolean(videoUrl),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

  const uri = coverUrl ?? generatedThumb ?? null;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width, height }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.videoPlaceholder, { width, height }]}>
      <Play
        size={24}
        color="rgba(255,255,255,0.6)"
        fill="rgba(255,255,255,0.6)"
      />
    </View>
  );
});

// ─── Individual masonry cell ────────────────────────────────────────────────

interface MasonryCellProps {
  post: Post;
  width: number;
  height: number;
  onPress: (id: string) => void;
}

const MasonryCell = memo(function MasonryCell({
  post,
  width,
  height,
  onPress,
}: MasonryCellProps) {
  const bookmarkedPosts = useBookmarkStore((s) => s.bookmarkedPosts);
  const isBookmarked = bookmarkedPosts.includes(post.id);
  const toggleBookmark = useToggleBookmark();
  const {
    likes: likesCount,
    hasLiked,
    toggle: toggleLike,
  } = usePostLikeState(post.id, post.likes || 0, post.viewerHasLiked || false);

  const handlePress = useCallback(() => onPress(post.id), [post.id, onPress]);

  const handleBookmark = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmark.mutate({ postId: post.id, isBookmarked });
  }, [post.id, isBookmarked, toggleBookmark]);

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike();
  }, [toggleLike]);

  const media = post.media?.[0];
  const isTextPost = post.kind === "text";
  const textPostPreview = resolveTextPostPresentation(
    post.textSlides,
    post.caption,
  );
  const isVideo = media?.type === "video";
  const isCarousel = (post.media?.length || 0) > 1;
  const isGif = media?.type === "gif";
  const isLivePhoto = media?.type === "livePhoto";
  const coverUrl = isVideo
    ? post.thumbnail || media?.thumbnail || null
    : media?.thumbnail || media?.url || null;

  return (
    <Pressable onPress={handlePress} style={{ marginBottom: COLUMN_GAP }}>
      <View style={[styles.cell, { width, height, borderRadius: CELL_RADIUS }]}>
        {isTextPost ? (
          <TextPostSurface
            text={textPostPreview.previewText}
            theme={post.textTheme}
            variant="grid"
            style={{ minHeight: height, height }}
          />
        ) : isVideo ? (
          <VideoThumb
            videoUrl={media?.url || ""}
            coverUrl={coverUrl}
            width={width}
            height={height}
          />
        ) : coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width, height }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={[styles.emptyCell, { width, height }]}>
            <Text style={styles.emptyCellText}>No preview</Text>
          </View>
        )}

        {isVideo && (
          <View style={styles.badgeTopRight}>
            <Play size={12} color="#fff" fill="#fff" />
          </View>
        )}
        {isCarousel && !isVideo && (
          <View style={styles.badgeTopRight}>
            <Grid3x3 size={12} color="#fff" />
          </View>
        )}
        {(isGif || isLivePhoto) && (
          <View style={styles.badgeTopRight}>
            <DVNTMediaBadge kind={isGif ? "gif" : "livePhoto"} />
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={styles.overlay}
        >
          <View style={styles.overlayRow}>
            <Pressable
              onPress={handleLike}
              hitSlop={8}
              style={styles.overlayAction}
            >
              <Heart
                size={14}
                color={hasLiked ? "#ef4444" : "#fff"}
                fill={hasLiked ? "#ef4444" : "transparent"}
              />
              {likesCount > 0 && (
                <Text style={styles.overlayText}>
                  {formatCount(likesCount)}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleBookmark}
              hitSlop={8}
              style={styles.overlayAction}
            >
              <Bookmark
                size={14}
                color={isBookmarked ? "#3FDCFF" : "#fff"}
                fill={isBookmarked ? "#3FDCFF" : "transparent"}
              />
            </Pressable>

            <Text style={styles.overlayTime}>{post.timeAgo || ""}</Text>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
});

// ─── Pack posts into 2 columns (shortest-first) ────────────────────────────

interface PackedPost {
  post: Post;
  height: number;
}

function packIntoColumns(
  posts: Post[],
  columnWidth: number,
): [PackedPost[], PackedPost[]] {
  const col0: PackedPost[] = [];
  const col1: PackedPost[] = [];
  let h0 = 0;
  let h1 = 0;

  for (const post of posts) {
    const height = Math.round(columnWidth * estimateRatio(post));
    if (h0 <= h1) {
      col0.push({ post, height });
      h0 += height + COLUMN_GAP;
    } else {
      col1.push({ post, height });
      h1 += height + COLUMN_GAP;
    }
  }

  return [col0, col1];
}

// ─── Build sections: masonry chunks interleaved with event cards ────────────

type MasonrySection =
  | { type: "masonry"; key: string; posts: Post[] }
  | { type: "event"; key: string; event: Event };

function buildSections(posts: Post[], events: Event[]): MasonrySection[] {
  const sections: MasonrySection[] = [];
  let eventIdx = 0;
  let chunkStart = 0;

  for (let i = 0; i < posts.length; i++) {
    if ((i + 1) % EVENT_INTERVAL === 0 && eventIdx < events.length) {
      // Flush current chunk of posts as masonry section
      if (i >= chunkStart) {
        sections.push({
          type: "masonry",
          key: `m-${chunkStart}`,
          posts: posts.slice(chunkStart, i + 1),
        });
      }
      // Insert event card
      sections.push({
        type: "event",
        key: `e-${events[eventIdx].id}`,
        event: events[eventIdx],
      });
      eventIdx++;
      chunkStart = i + 1;
    }
  }

  // Remaining posts after last event
  if (chunkStart < posts.length) {
    sections.push({
      type: "masonry",
      key: `m-${chunkStart}`,
      posts: posts.slice(chunkStart),
    });
  }

  return sections;
}

// ─── Masonry section renderer ───────────────────────────────────────────────

const MasonrySection_ = memo(function MasonrySection_({
  posts,
  columnWidth,
  onPress,
}: {
  posts: Post[];
  columnWidth: number;
  onPress: (id: string) => void;
}) {
  const [col0, col1] = useMemo(
    () => packIntoColumns(posts, columnWidth),
    [posts, columnWidth],
  );

  return (
    <View style={styles.gridContainer}>
      <View style={{ width: columnWidth }}>
        {col0.map(({ post, height }) => (
          <MasonryCell
            key={post.id}
            post={post}
            width={columnWidth}
            height={height}
            onPress={onPress}
          />
        ))}
      </View>
      <View style={{ width: columnWidth }}>
        {col1.map(({ post, height }) => (
          <MasonryCell
            key={post.id}
            post={post}
            width={columnWidth}
            height={height}
            onPress={onPress}
          />
        ))}
      </View>
    </View>
  );
});

// ─── Main MasonryFeed ───────────────────────────────────────────────────────

export function MasonryFeed() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const viewerId = useAuthStore((s) => s.user?.id) || "";
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTopTrigger = useFeedScrollStore((s) => s.scrollToTopTrigger);

  useEffect(() => {
    if (scrollToTopTrigger > 0 && scrollRef.current) {
      scrollRef.current.scrollTo?.({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);

  // Same data hooks as classic feed
  const bootstrapFeed = useBootstrapFeed();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteFeedPosts({
    enabled: bootstrapFeed.shouldEnableFeedQuery,
  });

  useSyncLikedPosts();
  useBookmarks();

  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const nsfwLoaded = useAppStore((s) => s.nsfwLoaded);
  const loadNsfwSetting = useAppStore((s) => s.loadNsfwSetting);

  useEffect(() => {
    loadNsfwSetting("masonry_feed_mount");
  }, [loadNsfwSetting]);

  useFocusEffect(
    useCallback(() => {
      loadNsfwSetting("masonry_feed_focus");
    }, [loadNsfwSetting]),
  );

  const allPosts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data).filter(shouldRenderInFeed);
  }, [data]);

  const {
    data: stories = [],
    isFetched: storiesFetched,
    isError: storiesErrored,
  } = useStories();

  // Seed like states from feed data
  useEffect(() => {
    if (!viewerId || !allPosts.length) return;
    allPosts
      .filter((post) => post?.id)
      .forEach((post) => {
        seedLikeState(
          queryClient,
          viewerId,
          post.id,
          post.viewerHasLiked === true,
          post.likes || 0,
        );
      });
  }, [allPosts, viewerId, queryClient]);

  const filteredPosts = useMemo(() => {
    if (nsfwEnabled) return allPosts;
    return allPosts.filter((post) => !post.isNSFW);
  }, [allPosts, nsfwEnabled]);

  const {
    data: forYouEvents,
    isFetched: eventsFetched,
    isError: eventsErrored,
  } = useForYouEvents();

  const [firstPageMediaPrefetched, setFirstPageMediaPrefetched] =
    useState(false);
  useEffect(() => {
    if (allPosts.length === 0 || firstPageMediaPrefetched) return;

    let cancelled = false;

    const warmInitialMedia = async () => {
      const firstPageUrls = extractFeedImageUrls(allPosts.slice(0, 8));
      if (firstPageUrls.length > 0) {
        await prefetchImagesBlocking(firstPageUrls);
      }
      if (cancelled) return;
      setFirstPageMediaPrefetched(true);

      const remainingUrls = extractFeedImageUrls(allPosts.slice(8));
      if (remainingUrls.length > 0) {
        prefetchImages(remainingUrls);
      }
    };

    void warmInitialMedia();
    return () => {
      cancelled = true;
    };
  }, [allPosts, firstPageMediaPrefetched]);

  useEffect(() => {
    if (isRefetching) {
      setFirstPageMediaPrefetched(false);
    }
  }, [isRefetching]);

  // Build interleaved sections
  const sections = useMemo(
    () => buildSections(filteredPosts, forYouEvents ?? []),
    [filteredPosts, forYouEvents],
  );

  // Layout
  const columnWidth = Math.floor(
    (screenWidth - COLUMN_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS,
  );

  const handlePress = useCallback(
    (id: string) => {
      navigateToPost(router, queryClient, id);
    },
    [router, queryClient],
  );

  const handleRefresh = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: storyKeys.list() });
    await refetch();
  }, [refetch, queryClient]);

  // Infinite scroll — fetch more when near bottom
  const handleScroll = useCallback(
    (e: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromBottom < 800 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const storiesReady = storiesFetched || storiesErrored;
  const eventsReady = eventsFetched || eventsErrored;
  const criticalImagesReady =
    filteredPosts.length === 0 ? true : firstPageMediaPrefetched;

  if (
    isLoading ||
    !nsfwLoaded ||
    !storiesReady ||
    !eventsReady ||
    !criticalImagesReady
  ) {
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
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 80 }}
      onScroll={handleScroll}
      scrollEventThrottle={200}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor="#fff"
        />
      }
    >
      <View style={{ height: 40 }} />
      <StoriesBar stories={stories} isLoadingOverride={!storiesReady} />

      {filteredPosts.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="No Posts Yet"
          description="When you or people you follow share posts, they'll appear here"
        />
      ) : (
        <>
          {sections.map((section) => {
            if (section.type === "event") {
              return <FeedEventCard key={section.key} event={section.event} />;
            }
            return (
              <MasonrySection_
                key={section.key}
                posts={section.posts}
                columnWidth={columnWidth}
                onPress={handlePress}
              />
            );
          })}
        </>
      )}

      {isFetchingNextPage && (
        <View style={styles.loadMore}>
          <Text style={styles.loadMoreText}>Loading...</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    paddingHorizontal: COLUMN_GAP,
    gap: COLUMN_GAP,
  },
  cell: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyCell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyCellText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  videoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  badgeTopRight: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 4,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 24,
    borderBottomLeftRadius: CELL_RADIUS,
    borderBottomRightRadius: CELL_RADIUS,
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  overlayAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  overlayText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  overlayTime: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    marginLeft: "auto",
  },
  loadMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadMoreText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
});
