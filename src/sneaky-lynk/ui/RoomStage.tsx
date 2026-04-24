/**
 * RoomStage
 *
 * Zoom-parity stage for Sneaky Lynk rooms. Replaces the adaptive
 * N-up VideoGrid with a decisive two-zone layout:
 *
 *   ┌──────────────────────────┐
 *   │  HOST HERO  (58% | 55%)  │  ← pinned, never scrolls
 *   ├──────────────────────────┤
 *   │  Crowd · N     1/3       │  ← divider + label + count
 *   │  ┌───┬───┐   ┌───┬───┐   │
 *   │  │ A │ B │ → │ E │ F │   │  ← horizontal paged carousel
 *   │  │ C │ D │   │ G │ H │   │    (2x2 per page)
 *   │  └───┴───┘   └───┴───┘   │
 *   │       •  o  o            │  ← pagination pill (morphs on scroll)
 *   └──────────────────────────┘
 *
 * Scaling:
 *   1           → host hero fills 100% vertical, empty-crowd state
 *   2–4 total   → hero 58% + single-page carousel, dots hidden
 *   5–9 total   → hero 58% + multi-page carousel, pill dots
 *   10+ total   → hero 55% + multi-page carousel, numeric N/M indicator
 *
 * Design direction (via the frontend-design skill): DJ-booth + crowd.
 * Host on the plinth, attendees in the paged pit. DVNT cyan + accent
 * pink appear only where they signal state (the pagination pill is
 * the one place they cross — a cyan→pink gradient that morphs across
 * the row as you swipe, like a lighting cue).
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Users } from "lucide-react-native";
import { VideoTile, type VideoParticipant } from "./VideoGrid";

interface RoomStageProps {
  /** Full flat list including local/host + remotes. Host is picked out
   *  automatically (first participant with role === "host"). If no host
   *  is found, the first local participant is used as the hero tile. */
  participants: VideoParticipant[];
  activeSpeakers: Set<string>;
  isHost: boolean;
  onParticipantPress?: (participant: VideoParticipant) => void;
}

const HERO_ASPECT = 16 / 10; // landscape-feel main stage
const SIDE_PAD = 12;
const TILE_GAP = 8;
const TILES_PER_ROW = 2;
const ROWS_PER_PAGE = 2;
const TILES_PER_PAGE = TILES_PER_ROW * ROWS_PER_PAGE; // 4
const NUMERIC_INDICATOR_THRESHOLD = 6; // pages > this → show "N/M"

export const RoomStage = memo(function RoomStage({
  participants,
  activeSpeakers,
  isHost,
  onParticipantPress,
}: RoomStageProps) {
  const { width: screenWidth } = useWindowDimensions();

  // ── Host/attendee partition ──────────────────────────────────────
  const { host, attendees } = useMemo(() => {
    const hostParticipant =
      participants.find((p) => p.role === "host") ||
      participants.find((p) => p.isLocal) ||
      participants[0] ||
      null;
    const rest = hostParticipant
      ? participants.filter((p) => p.id !== hostParticipant.id)
      : participants;
    return { host: hostParticipant, attendees: rest };
  }, [participants]);

  const totalCount = participants.length;
  const attendeeCount = attendees.length;

  // Hero shrinks slightly when the room is packed to give the crowd
  // room to breathe. Under 10 participants, hero takes 58%; past 10
  // it drops to 55%. The rest of the vertical budget belongs to the
  // carousel + its label + pagination.
  const heroFlex = totalCount >= 10 ? 55 : 58;
  const crowdFlex = 100 - heroFlex;

  // ── Carousel math ────────────────────────────────────────────────
  const pageWidth = screenWidth - SIDE_PAD * 2;
  const tileWidth = (pageWidth - TILE_GAP) / TILES_PER_ROW;
  const tileHeight = tileWidth * 1.1; // slight portrait bias for faces

  const pages = useMemo<VideoParticipant[][]>(() => {
    if (attendees.length === 0) return [];
    const chunks: VideoParticipant[][] = [];
    for (let i = 0; i < attendees.length; i += TILES_PER_PAGE) {
      chunks.push(attendees.slice(i, i + TILES_PER_PAGE));
    }
    return chunks;
  }, [attendees]);

  const pageCount = pages.length;
  const showPagination = pageCount > 1;
  const useNumericIndicator = pageCount > NUMERIC_INDICATOR_THRESHOLD;

  // Scroll offset shared value → pagination morphs smoothly with
  // gesture, not on discrete page boundaries. Gives the lighting-cue
  // feel from the design brief.
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Empty-state halo pulse. Slow, single concern. No spinner noise.
  const pulse = useSharedValue(0.6);
  React.useEffect(() => {
    if (attendeeCount > 0) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [attendeeCount, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const renderHero = useCallback(() => {
    if (!host) return null;
    return (
      <View style={{ paddingHorizontal: SIDE_PAD, paddingTop: 4 }}>
        <View
          style={{
            width: pageWidth,
            aspectRatio: HERO_ASPECT,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <VideoTile
            participant={host}
            isSpeaking={activeSpeakers.has(host.user.id)}
            tileWidth={pageWidth}
            tileHeight={pageWidth / HERO_ASPECT}
            isHost={isHost}
            onPress={
              isHost && !host.isLocal
                ? () => onParticipantPress?.(host)
                : undefined
            }
          />
        </View>
      </View>
    );
  }, [host, isHost, pageWidth, activeSpeakers, onParticipantPress]);

  const renderCrowdLabel = useCallback(() => {
    if (attendeeCount === 0) return null;
    return (
      <View style={styles.crowdHeader}>
        <View style={styles.crowdHeaderLeft}>
          <Text style={styles.crowdLabel}>CROWD</Text>
          <View style={styles.crowdCountPill}>
            <Text style={styles.crowdCountText}>{attendeeCount}</Text>
          </View>
        </View>
        {showPagination && useNumericIndicator ? (
          <NumericPagination scrollX={scrollX} pageWidth={pageWidth} pageCount={pageCount} />
        ) : null}
      </View>
    );
  }, [
    attendeeCount,
    showPagination,
    useNumericIndicator,
    scrollX,
    pageWidth,
    pageCount,
  ]);

  const renderPage = useCallback(
    (pageIndex: number) => {
      const page = pages[pageIndex];
      if (!page) return null;
      return (
        <View
          key={`page-${pageIndex}`}
          style={{
            width: pageWidth,
            paddingHorizontal: 0,
          }}
        >
          <View style={styles.pageGrid}>
            {page.map((p) => (
              <View
                key={p.id}
                style={{
                  width: tileWidth,
                  height: tileHeight,
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <VideoTile
                  participant={p}
                  isSpeaking={activeSpeakers.has(p.user.id)}
                  tileWidth={tileWidth}
                  tileHeight={tileHeight}
                  isHost={isHost}
                  onPress={
                    isHost && !p.isLocal ? () => onParticipantPress?.(p) : undefined
                  }
                />
              </View>
            ))}
            {/* Fill the last row with invisible placeholders so a partial
                page doesn't left-align into an awkward L-shape. */}
            {Array.from({
              length: Math.max(0, TILES_PER_PAGE - page.length),
            }).map((_, i) => (
              <View
                key={`placeholder-${pageIndex}-${i}`}
                style={{ width: tileWidth, height: tileHeight }}
              />
            ))}
          </View>
        </View>
      );
    },
    [
      pages,
      pageWidth,
      tileWidth,
      tileHeight,
      activeSpeakers,
      isHost,
      onParticipantPress,
    ],
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Hero zone — pinned, non-scrolling. Gets its % of flex so the
          carousel underneath always has a stable home regardless of
          attendee count. */}
      <View style={{ flex: heroFlex }}>{renderHero()}</View>

      {/* Crowd zone — label + carousel + pagination. */}
      <View style={{ flex: crowdFlex, paddingTop: 8 }}>
        {/* Hairline divider — cyan→pink gradient at low alpha. The one
            and only place the two brand colors cross on this surface. */}
        <LinearGradient
          colors={[
            "rgba(62,164,229,0)",
            "rgba(62,164,229,0.35)",
            "rgba(255,109,193,0.35)",
            "rgba(255,109,193,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />

        {renderCrowdLabel()}

        {attendeeCount === 0 ? (
          <EmptyCrowdState pulseStyle={pulseStyle} />
        ) : (
          <>
            <Animated.ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={pageWidth}
              snapToAlignment="start"
              contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
              style={{ flexGrow: 0 }}
            >
              {pages.map((_, i) => renderPage(i))}
            </Animated.ScrollView>

            {showPagination && !useNumericIndicator ? (
              <PaginationPill
                scrollX={scrollX}
                pageWidth={pageWidth}
                pageCount={pageCount}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
});

// ── Pagination pill — cyan→pink gradient morph on scroll offset ─────

const PILL_TRACK_WIDTH = 112;
const PILL_DOT = 5;
const PILL_ACTIVE = 22;

const PaginationPill = memo(function PaginationPill({
  scrollX,
  pageWidth,
  pageCount,
}: {
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
}) {
  // Bound the active-dot slot to [0, pageCount-1] fractional.
  const activeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [0, pageWidth * (pageCount - 1)],
      [0, pageCount - 1],
      Extrapolation.CLAMP,
    );
    const slotWidth = PILL_TRACK_WIDTH / pageCount;
    const translateX = progress * slotWidth + (slotWidth - PILL_ACTIVE) / 2;
    return { transform: [{ translateX }] };
  });

  return (
    <View style={styles.pillWrap} pointerEvents="none">
      <View style={[styles.pillTrack, { width: PILL_TRACK_WIDTH }]}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.pillDot,
              {
                width: PILL_DOT,
                height: PILL_DOT,
                borderRadius: PILL_DOT / 2,
              },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.pillActiveShell,
            { width: PILL_ACTIVE, height: PILL_DOT + 1 },
            activeStyle,
          ]}
        >
          <LinearGradient
            colors={["rgb(62,164,229)", "rgb(255,109,193)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </Animated.View>
      </View>
    </View>
  );
});

// ── Numeric "N/M" fallback for packed rooms ────────────────────────

// Reanimated updates animated TextInput `text` props from the UI thread
// without crossing the JS bridge → no useState needed for the page
// number. editable={false} + pointerEvents="none" makes it render as
// a pure text readout.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const NumericPagination = memo(function NumericPagination({
  scrollX,
  pageWidth,
  pageCount,
}: {
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const page =
      Math.round(
        interpolate(
          scrollX.value,
          [0, pageWidth * (pageCount - 1)],
          [0, pageCount - 1],
          Extrapolation.CLAMP,
        ),
      ) + 1;
    return { text: String(page), defaultValue: String(page) } as any;
  });

  return (
    <View style={styles.numericWrap} pointerEvents="none">
      <View style={styles.numericRow}>
        <AnimatedTextInput
          editable={false}
          style={[styles.numericTextBase, styles.numericTextActive]}
          animatedProps={animatedProps}
          defaultValue="1"
        />
        <Text style={[styles.numericTextBase, styles.numericTextSlash]}>
          {" / "}
        </Text>
        <Text style={[styles.numericTextBase, styles.numericTextTotal]}>
          {pageCount}
        </Text>
      </View>
    </View>
  );
});

// ── Empty state — host is alone ─────────────────────────────────────

const EmptyCrowdState = memo(function EmptyCrowdState({
  pulseStyle,
}: {
  pulseStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={[styles.emptyHalo, pulseStyle]}>
        <Users size={24} color="rgb(62,164,229)" />
      </Animated.View>
      <Text style={styles.emptyTitle}>Waiting for the crowd</Text>
      <Text style={styles.emptyBody}>
        Share the link — people will slide in the moment they tap it.
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginHorizontal: SIDE_PAD,
    marginBottom: 10,
    opacity: 0.9,
  },
  crowdHeader: {
    paddingHorizontal: SIDE_PAD + 4,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  crowdHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  crowdLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  crowdCountPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: "rgba(62,164,229,0.16)",
    borderWidth: 1,
    borderColor: "rgba(62,164,229,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  crowdCountText: {
    color: "rgb(62,164,229)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  pageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },

  pillWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  pillTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: PILL_DOT + 2,
    position: "relative",
  },
  pillDot: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  pillActiveShell: {
    position: "absolute",
    left: 0,
    top: 1,
    overflow: "hidden",
    borderRadius: 999,
  },

  numericWrap: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  numericRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  numericTextBase: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  numericTextActive: {
    color: "rgb(62,164,229)",
    minWidth: 12,
    textAlign: "center",
  },
  numericTextSlash: {
    color: "rgba(255,255,255,0.35)",
  },
  numericTextTotal: {
    color: "rgba(255,255,255,0.72)",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyHalo: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: "rgba(62,164,229,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(62,164,229,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },
});
