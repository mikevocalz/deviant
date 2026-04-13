/**
 * SpotlightCarousel — Promoted events horizontal pager.
 *
 * Design: wide landscape cards, smooth Reanimated scroll-driven dots,
 * no BlurView, no crossfading background — clean and fast.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Zap, MapPin } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { SpotlightItem } from "@/src/events/promotion-types";

// ── Spotlight Card ───────────────────────────────────────────────────────────

function SpotlightCard({
  item,
  cardWidth,
  cardHeight,
}: {
  item: SpotlightItem;
  cardWidth: number;
  cardHeight: number;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() =>
        router.push(`/(protected)/events/${item.event_id}` as any)
      }
      style={{ width: cardWidth, marginHorizontal: 6 }}
    >
      <View
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#1a1a1a",
        }}
      >
        <Image
          source={{ uri: item.spotlight_image || item.cover_image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.82)"]}
          locations={[0.35, 0.6, 1]}
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "flex-end",
            padding: 16,
          }}
        >
          {/* Promoted badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(245,158,11,0.9)",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Zap size={10} color="#fff" fill="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                SPOTLIGHT
              </Text>
            </View>
            {item.category && (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "500" }}>
                  {item.category}
                </Text>
              </View>
            )}
          </View>

          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "700",
              lineHeight: 22,
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <MapPin size={11} color="rgba(255,255,255,0.6)" />
            <Text
              style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
              numberOfLines={1}
            >
              {item.location}
            </Text>
            {item.price != null && (
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: "700",
                  marginLeft: "auto",
                }}
              >
                {item.price === 0 ? "Free" : `$${item.price}`}
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

// ── Animated Dot ─────────────────────────────────────────────────────────────

function AnimatedDot({
  index,
  scrollX,
  itemWidth,
  count,
}: {
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  count: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = scrollX.value / itemWidth;
    const width = interpolate(
      input,
      [index - 1, index, index + 1],
      [5, 18, 5],
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
          backgroundColor: "#fff",
        },
        animatedStyle,
      ]}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SpotlightSection({ items }: { items: SpotlightItem[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrollingRef = useRef(false);
  const activeIndexRef = useRef(0);

  const CARD_WIDTH = screenWidth - 64;
  const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.58);
  const ITEM_WIDTH = CARD_WIDTH + 12;
  const PADDING = (screenWidth - CARD_WIDTH) / 2 - 6;

  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Reset on mount
  useEffect(() => {
    activeIndexRef.current = 0;
    scrollX.value = 0;
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = setInterval(() => {
      if (isUserScrollingRef.current) return;
      const next = (activeIndexRef.current + 1) % items.length;
      activeIndexRef.current = next;
      scrollRef.current?.scrollTo({
        x: next * ITEM_WIDTH,
        animated: true,
      });
    }, 4000);
  }, [items.length, ITEM_WIDTH]);

  useEffect(() => {
    if (items.length > 1) startAutoScroll();
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [items.length, startAutoScroll]);

  const handleScrollBegin = useCallback(() => {
    isUserScrollingRef.current = true;
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
  }, []);

  const handleScrollEnd = useCallback(
    (e: any) => {
      isUserScrollingRef.current = false;
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.max(
        0,
        Math.min(Math.round(offsetX / ITEM_WIDTH), items.length - 1),
      );
      activeIndexRef.current = idx;
      if (items.length > 1) startAutoScroll();
    },
    [items.length, ITEM_WIDTH, startAutoScroll],
  );

  if (items.length === 0) return null;

  return (
    <View style={{ paddingTop: 12, paddingBottom: 4 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          marginBottom: 10,
        }}
      >
        <Zap size={14} color="#f59e0b" fill="#f59e0b" />
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
          Spotlight
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
          · Promoted
        </Text>
      </View>

      {/* Cards — Animated.ScrollView for scroll-driven dot animation */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEnabled={items.length > 1}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PADDING }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item) => (
          <SpotlightCard
            key={item.campaign_id}
            item={item}
            cardWidth={CARD_WIDTH}
            cardHeight={CARD_HEIGHT}
          />
        ))}
      </Animated.ScrollView>

      {/* Scroll-driven dots */}
      {items.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            marginTop: 12,
          }}
        >
          {Array.from({ length: Math.min(items.length, 8) }).map((_, i) => (
            <AnimatedDot
              key={i}
              index={i}
              scrollX={scrollX}
              itemWidth={ITEM_WIDTH}
              count={items.length}
            />
          ))}
        </View>
      )}
    </View>
  );
}
