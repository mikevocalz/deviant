/**
 * ProfileMasonryGrid
 *
 * Legend List v3 multi-column masonry grid for profile posts.
 *
 * - 2 columns on phone, 3 on tablet (≥768px)
 * - Variable cell heights by media kind (portrait image, square carousel, etc.)
 * - Video cells always show thumbnail via getVideoThumbnail() — never black
 * - recycleItems=true for smooth virtualized scrolling
 * - Tapping a cell routes to /(protected)/post/[id]
 */
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { useCallback, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Play, Grid3x3 } from "lucide-react-native";
import { type SafeGridTile } from "@/lib/utils/safe-profile-mappers";
import { DVNTMediaBadge } from "@/components/media/DVNTMediaBadge";
import { screenPrefetch } from "@/lib/prefetch";
import { getVideoThumbnail } from "@/lib/media/getVideoThumbnail";

// ─── Layout constants ────────────────────────────────────────────────────────

const COLUMN_GAP = 3;
const CELL_PADDING = 1.5;

/** Height multiplier relative to column width, by media kind. */
function heightRatioForKind(kind: SafeGridTile["kind"]): number {
  switch (kind) {
    case "video":
      return 1.25; // 4:5 portrait feel
    case "carousel":
      return 1.0; // square
    case "gif":
      return 0.75; // landscape
    case "livePhoto":
      return 1.1;
    default:
      return 1.2; // slightly portrait for images
  }
}

// ─── Video thumbnail cell (async, never black) ───────────────────────────────

interface VideoThumbnailCellProps {
  videoUrl: string;
  coverUrl: string | null;
  width: number;
  height: number;
}

const VideoThumbnailCell = memo(function VideoThumbnailCell({
  videoUrl,
  coverUrl,
  width,
  height,
}: VideoThumbnailCellProps) {
  const { data: generatedThumb } = useQuery({
    queryKey: ["videoThumb", videoUrl],
    queryFn: () => getVideoThumbnail(videoUrl),
    enabled: !coverUrl && Boolean(videoUrl),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

  const thumbUri = coverUrl ?? generatedThumb ?? null;

  return thumbUri ? (
    <Image
      source={{ uri: thumbUri }}
      style={{ width, height }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
    />
  ) : (
    <View style={[styles.videoPlaceholder, { width, height }]}>
      <Play
        size={24}
        color="rgba(255,255,255,0.6)"
        fill="rgba(255,255,255,0.6)"
      />
    </View>
  );
});

// ─── Individual masonry cell ──────────────────────────────────────────────────

interface MasonryCellProps {
  item: SafeGridTile;
  columnWidth: number;
  userId?: string | number;
}

const MasonryCell = memo(function MasonryCell({
  item,
  columnWidth,
  userId,
}: MasonryCellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cellHeight = Math.round(columnWidth * heightRatioForKind(item.kind));

  const handlePress = useCallback(() => {
    if (item?.id) {
      screenPrefetch.postDetail(queryClient, item.id);
      router.push(`/(protected)/post/${item.id}` as any);
    }
  }, [item.id, router, queryClient]);

  return (
    <Pressable
      onPress={handlePress}
      testID={`profile.${userId}.gridTile.${item.id}`}
      style={[styles.cell, { padding: CELL_PADDING }]}
    >
      <View
        style={[
          styles.cellInner,
          { width: columnWidth - CELL_PADDING * 2, height: cellHeight },
        ]}
      >
        {item.kind === "video" ? (
          <VideoThumbnailCell
            videoUrl={item.videoUrl ?? ""}
            coverUrl={item.coverUrl}
            width={columnWidth - CELL_PADDING * 2}
            height={cellHeight}
          />
        ) : item.coverUrl ? (
          <Image
            source={{ uri: item.coverUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.emptyCell}>
            <Text style={styles.emptyCellText}>No preview</Text>
          </View>
        )}

        {/* Kind badge overlays */}
        {item.kind === "video" && (
          <View style={styles.badgeTopRight}>
            <Play size={14} color="#fff" fill="#fff" />
          </View>
        )}
        {item.kind === "carousel" && (
          <View style={styles.badgeTopRight}>
            <Grid3x3 size={14} color="#fff" />
          </View>
        )}
        {(item.kind === "gif" || item.kind === "livePhoto") && (
          <DVNTMediaBadge kind={item.kind} />
        )}
      </View>
    </Pressable>
  );
});

// ─── Main grid ────────────────────────────────────────────────────────────────

interface ProfileMasonryGridProps {
  data: SafeGridTile[];
  userId?: string | number;
  /** Set false when nested inside an outer ScrollView */
  scrollEnabled?: boolean;
  /** Rendered above the list */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Rendered when the list is empty */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
}

export function ProfileMasonryGrid({
  data,
  userId,
  scrollEnabled = true,
  ListHeaderComponent,
  ListEmptyComponent,
}: ProfileMasonryGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const numColumns = isTablet ? 3 : 2;

  const totalGap = COLUMN_GAP * (numColumns + 1);
  const columnWidth = Math.floor((screenWidth - totalGap) / numColumns);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<SafeGridTile>) => (
      <MasonryCell item={item} columnWidth={columnWidth} userId={userId} />
    ),
    [columnWidth, userId],
  );

  const keyExtractor = useCallback(
    (item: SafeGridTile, index: number) => `${item.id}-${index}`,
    [],
  );

  const getEstimatedItemSize = useCallback(
    (item: SafeGridTile) =>
      Math.round(columnWidth * heightRatioForKind(item.kind)) +
      CELL_PADDING * 2,
    [columnWidth],
  );

  return (
    <LegendList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      estimatedItemSize={columnWidth + CELL_PADDING * 2}
      getEstimatedItemSize={getEstimatedItemSize}
      recycleItems
      scrollEnabled={scrollEnabled}
      contentContainerStyle={{ paddingHorizontal: COLUMN_GAP }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      drawDistance={columnWidth * 8}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cell: {
    flex: 1,
  },
  cellInner: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  videoPlaceholder: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  emptyCellText: {
    fontSize: 11,
    color: "#737373",
    textAlign: "center",
  },
  badgeTopRight: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 100,
    padding: 5,
  },
});
