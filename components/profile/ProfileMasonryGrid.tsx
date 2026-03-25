/**
 * ProfileMasonryGrid
 *
 * Featured masonry grid — large left + 2 stacked right, alternating.
 *
 * - Groups posts in chunks of 3
 * - Odd groups: large cell LEFT, 2 stacked RIGHT
 * - Even groups: 2 stacked LEFT, large cell RIGHT
 * - Remaining 1–2 posts render as equal-width cells
 * - Video cells always show thumbnail via getVideoThumbnail() — never black
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
import { useCallback, useMemo, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Play, Grid3x3 } from "lucide-react-native";
import { type SafeGridTile } from "@/lib/utils/safe-profile-mappers";
import { DVNTMediaBadge } from "@/components/media/DVNTMediaBadge";
import { navigateToPost } from "@/lib/routes/post-routes";
import { getVideoThumbnail } from "@/lib/media/getVideoThumbnail";
import { LegendList } from "@/components/list";
import { TextPostSurface } from "@/components/post/TextPostSurface";

// ─── Constants ───────────────────────────────────────────────────────────────

const CELL_GAP = 3;
const CELL_BORDER_RADIUS = 8;

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
      contentPosition="top"
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

// ─── Individual cell (no margin — parent controls spacing) ─────────────────

interface GridCellProps {
  tile: SafeGridTile;
  width: number;
  height: number;
  borderRadius: number;
  userId?: string | number;
  onPress: (id: string) => void;
}

const GridCell = memo(function GridCell({
  tile,
  width,
  height,
  borderRadius,
  userId,
  onPress,
}: GridCellProps) {
  const handlePress = useCallback(() => onPress(tile.id), [tile.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      testID={`profile.${userId}.gridTile.${tile.id}`}
    >
      <View style={[styles.cellInner, { width, height, borderRadius }]}>
        {tile.kind === "text" ? (
          <TextPostSurface
            text={tile.text}
            theme={tile.textTheme}
            variant="grid"
            style={{ minHeight: height, height }}
          />
        ) : tile.kind === "video" ? (
          <VideoThumbnailCell
            videoUrl={tile.videoUrl ?? ""}
            coverUrl={tile.coverUrl}
            width={width}
            height={height}
          />
        ) : tile.coverUrl ? (
          <Image
            source={{ uri: tile.coverUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            contentPosition="top"
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
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Featured masonry dimensions
  const pad = CELL_GAP;
  const available = screenWidth - pad * 2 - CELL_GAP;
  const largeW = Math.floor(available * 0.58);
  const smallW = available - largeW;
  const smallH = Math.floor(smallW * 1.15);
  const largeH = smallH * 2 + CELL_GAP;
  const radius = CELL_BORDER_RADIUS;

  // Group into chunks of 3
  const groups = useMemo(() => {
    const g: SafeGridTile[][] = [];
    for (let i = 0; i < data.length; i += 3) {
      g.push(data.slice(i, i + 3));
    }
    return g;
  }, [data]);

  const handlePress = useCallback(
    (id: string) => {
      navigateToPost(router, queryClient, id);
    },
    [router, queryClient],
  );

  const gridData = data.length > 0 ? GRID_ITEM : EMPTY;

  const totalHeight = groups.reduce(
    (h, g) => h + (g.length >= 3 ? largeH : smallH) + CELL_GAP,
    0,
  );

  const renderItem = useCallback(
    () => (
      <View>
        {groups.map((group, gIdx) => {
          const flipped = gIdx % 2 === 1;

          if (group.length >= 3) {
            const largeCell = (
              <GridCell
                key={group[0].id}
                tile={group[0]}
                width={largeW}
                height={largeH}
                borderRadius={radius}
                userId={userId}
                onPress={handlePress}
              />
            );
            const stackedCells = (
              <View key={`stack-${gIdx}`}>
                <GridCell
                  tile={group[1]}
                  width={smallW}
                  height={smallH}
                  borderRadius={radius}
                  userId={userId}
                  onPress={handlePress}
                />
                <View style={{ height: CELL_GAP }} />
                <GridCell
                  tile={group[2]}
                  width={smallW}
                  height={smallH}
                  borderRadius={radius}
                  userId={userId}
                  onPress={handlePress}
                />
              </View>
            );

            return (
              <View
                key={`g-${gIdx}`}
                style={{
                  flexDirection: "row",
                  paddingHorizontal: pad,
                  gap: CELL_GAP,
                  marginBottom: CELL_GAP,
                }}
              >
                {flipped ? (
                  <>
                    {stackedCells}
                    {largeCell}
                  </>
                ) : (
                  <>
                    {largeCell}
                    {stackedCells}
                  </>
                )}
              </View>
            );
          }

          if (group.length === 2) {
            const halfW = Math.floor(available / 2);
            return (
              <View
                key={`g-${gIdx}`}
                style={{
                  flexDirection: "row",
                  paddingHorizontal: pad,
                  gap: CELL_GAP,
                  marginBottom: CELL_GAP,
                }}
              >
                <GridCell
                  tile={group[0]}
                  width={halfW}
                  height={smallH}
                  borderRadius={radius}
                  userId={userId}
                  onPress={handlePress}
                />
                <GridCell
                  tile={group[1]}
                  width={halfW}
                  height={smallH}
                  borderRadius={radius}
                  userId={userId}
                  onPress={handlePress}
                />
              </View>
            );
          }

          return (
            <View
              key={`g-${gIdx}`}
              style={{ paddingHorizontal: pad, marginBottom: CELL_GAP }}
            >
              <GridCell
                tile={group[0]}
                width={available + CELL_GAP}
                height={smallH}
                borderRadius={radius}
                userId={userId}
                onPress={handlePress}
              />
            </View>
          );
        })}
      </View>
    ),
    [
      groups,
      largeW,
      smallW,
      largeH,
      smallH,
      radius,
      userId,
      handlePress,
      pad,
      available,
    ],
  );

  const keyExtractor = useCallback((item: GridRow) => item.key, []);

  return (
    <LegendList
      data={gridData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={totalHeight || 300}
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
