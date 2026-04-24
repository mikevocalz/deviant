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
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
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

// Sneaky Lynk room dot colors — alternating DVNT cyan/pink. Rotates
// per-index so every page gets a visually distinct dot, same pattern
// as the DVNT spotlight carousel's AnimatedDot.
const DOT_COLORS = ["rgb(62,164,229)", "rgb(255,109,193)"];

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
      </View>
    );
  }, [attendeeCount]);

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

            {showPagination ? (
              <PaginationDots
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

// ── Pagination dots — DVNT pattern: width + opacity interpolate on
// scroll, per-dot brand colors. Active dot pill-widens to 20, inactive
// dots shrink to 5. Scales cleanly from 2 pages to 20+.

const PaginationDots = memo(function PaginationDots({
  scrollX,
  pageWidth,
  pageCount,
}: {
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
}) {
  return (
    <View style={styles.dotsWrap} pointerEvents="none">
      {Array.from({ length: pageCount }).map((_, i) => (
        <AnimatedDot
          key={`dot-${i}`}
          index={i}
          scrollX={scrollX}
          pageWidth={pageWidth}
          dotColor={DOT_COLORS[i % DOT_COLORS.length]}
        />
      ))}
    </View>
  );
});

const AnimatedDot = memo(function AnimatedDot({
  index,
  scrollX,
  pageWidth,
  dotColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  dotColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const width = interpolate(
      input,
      [index - 1, index, index + 1],
      [5, 20, 5],
      "clamp",
    );
    const opacity = interpolate(
      input,
      [index - 1, index, index + 1],
      [0.3, 1, 0.3],
      "clamp",
    );
    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        {
          height: 5,
          borderRadius: 3,
          backgroundColor: dotColor,
          marginHorizontal: 3,
        },
        animatedStyle,
      ]}
    />
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

  dotsWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 4,
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
