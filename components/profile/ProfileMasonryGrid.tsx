/**
 * ProfileMasonryGrid
 *
 * TRUE masonry grid — shortest-column packing, no row locking.
 *
 * - 2 columns on phone, 3 on tablet (≥768), 4 on large (≥1024)
 * - Variable cell heights by media kind + deterministic per-post variation
 * - Video cells always show thumbnail via getVideoThumbnail() — never black
 * - Renders N columns side-by-side inside a LegendList scroll container
 * - Tapping a cell routes to /(protected)/post/[id]
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useCallback, useMemo, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Play, Grid3x3 } from "lucide-react-native";
import { type SafeGridTile } from "@/lib/utils/safe-profile-mappers";
import { DVNTMediaBadge } from "@/components/media/DVNTMediaBadge";
import { screenPrefetch } from "@/lib/prefetch";
import { getVideoThumbnail } from "@/lib/media/getVideoThumbnail";
import { LegendList } from "@/components/list";
import {
  useMasonryLayout,
  type MasonryTile,
} from "@/lib/masonry/use-masonry-layout";

// ─── Constants ───────────────────────────────────────────────────────────────

const CELL_GAP = 3;

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
  item: MasonryTile;
  columnWidth: number;
  borderRadius: number;
  userId?: string | number;
}

const MasonryCell = memo(function MasonryCell({
  item,
  columnWidth,
  borderRadius,
  userId,
}: MasonryCellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tile = item.tile;
  const cellHeight = item.estimatedHeight;

  const handlePress = useCallback(() => {
    if (tile?.id) {
      screenPrefetch.postDetail(queryClient, tile.id);
      router.push(`/(protected)/post/${tile.id}` as any);
    }
  }, [tile.id, router, queryClient]);

  return (
    <Pressable
      onPress={handlePress}
      testID={`profile.${userId}.gridTile.${tile.id}`}
      style={{ marginBottom: CELL_GAP }}
    >
      <View
        style={[
          styles.cellInner,
          { width: columnWidth, height: cellHeight, borderRadius },
        ]}
      >
        {tile.kind === "video" ? (
          <VideoThumbnailCell
            videoUrl={tile.videoUrl ?? ""}
            coverUrl={tile.coverUrl}
            width={columnWidth}
            height={cellHeight}
          />
        ) : tile.coverUrl ? (
          <Image
            source={{ uri: tile.coverUrl }}
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
        {tile.kind === "video" && (
          <View style={styles.badgeTopRight}>
            <Play size={14} color="#fff" fill="#fff" />
          </View>
        )}
        {tile.kind === "carousel" && (
          <View style={styles.badgeTopRight}>
            <Grid3x3 size={14} color="#fff" />
          </View>
        )}
        {(tile.kind === "gif" || tile.kind === "livePhoto") && (
          <DVNTMediaBadge kind={tile.kind} />
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

// Stable singleton so LegendList doesn't see a new array reference every render
type GridRow = { key: string };
const GRID_ITEM: GridRow[] = [{ key: "masonry-grid" }];
const EMPTY: GridRow[] = [];

export function ProfileMasonryGrid({
  data,
  userId,
  scrollEnabled = true,
  ListHeaderComponent,
  ListEmptyComponent,
}: ProfileMasonryGridProps) {
  const { packed, columnWidth, columnCount, columnGap, cellBorderRadius } =
    useMasonryLayout(data);

  // Single-item data: one entry = entire masonry grid; empty = show ListEmptyComponent
  const gridData = data.length > 0 ? GRID_ITEM : EMPTY;

  const renderItem = useCallback(
    () => (
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: columnGap,
          gap: columnGap,
        }}
      >
        {packed.columns.map((column, colIdx) => (
          <View key={`col-${colIdx}`} style={{ width: columnWidth }}>
            {column.items.map((item) => (
              <MasonryCell
                key={item.id}
                item={item}
                columnWidth={columnWidth}
                borderRadius={cellBorderRadius}
                userId={userId}
              />
            ))}
          </View>
        ))}
      </View>
    ),
    [packed, columnWidth, columnGap, cellBorderRadius, userId],
  );

  const keyExtractor = useCallback((item: GridRow) => item.key, []);

  return (
    <LegendList
      data={gridData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={packed.maxHeight || 300}
      recycleItems={false}
      scrollEnabled={scrollEnabled}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cellInner: {
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
