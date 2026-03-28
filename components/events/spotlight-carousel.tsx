/**
 * SpotlightCarousel — Infinite auto-scrolling carousel for promoted events.
 *
 * Adapted from the GameStoreHero pattern:
 * - Dynamic blurred background that crossfades on index change
 * - 3:5 aspect ratio cards with gradient overlay
 * - Auto-scroll with pause on touch
 *
 * Uses ScrollView + Reanimated (not FlatList/FlashList per project rules).
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Zap } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { create } from "zustand";
import type { SpotlightItem } from "@/src/events/promotion-types";

// ── Local Zustand store for carousel state (NO useState) ─────────────────────

interface SpotlightCarouselState {
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}

const useCarouselStore = create<SpotlightCarouselState>((set) => ({
  activeIndex: 0,
  setActiveIndex: (i) => set({ activeIndex: i }),
}));

// ── Dynamic Background ───────────────────────────────────────────────────────

function DynamicBackground({ uri }: { uri?: string }) {
  if (!uri) return null;
  return (
    <Animated.View
      key={uri}
      entering={FadeIn.duration(800)}
      exiting={FadeOut.duration(800)}
      className="absolute inset-0"
    >
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
}

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
        className="rounded-3xl overflow-hidden"
        style={{
          width: cardWidth,
          height: cardHeight,
          backgroundColor: "rgba(255,255,255,0.1)",
        }}
      >
        <Image
          source={{ uri: item.spotlight_image || item.cover_image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.7)"]}
          className="absolute inset-0 justify-end"
        >
          <View className="p-4">
            <View className="flex-row items-center gap-1.5 mb-2">
              <View className="bg-amber-500/90 px-2 py-0.5 rounded-lg flex-row items-center gap-1">
                <Zap size={10} color="#fff" fill="#fff" />
                <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                  Promoted
                </Text>
              </View>
              {item.category && (
                <View className="bg-white/20 px-2 py-0.5 rounded-lg">
                  <Text className="text-white text-[10px] font-medium">
                    {item.category}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-white text-lg font-bold"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text className="text-white/70 text-xs mt-1" numberOfLines={1}>
              {item.location}
            </Text>
            {item.price != null && (
              <Text className="text-white font-bold text-sm mt-1">
                {item.price === 0 ? "Free" : `$${item.price}`}
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

// ── Dot Indicator ────────────────────────────────────────────────────────────

function DotIndicator({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View className="flex-row items-center justify-center gap-1.5 mt-3">
      {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
        <View
          key={i}
          className="rounded-full"
          style={{
            width: i === activeIndex ? 16 : 6,
            height: 6,
            backgroundColor:
              i === activeIndex ? "#fff" : "rgba(255,255,255,0.3)",
            borderRadius: 3,
          }}
        />
      ))}
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SpotlightSection({ items }: { items: SpotlightItem[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const activeIndex = useCarouselStore((s) => s.activeIndex);
  const setActiveIndex = useCarouselStore((s) => s.setActiveIndex);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const CARD_WIDTH = Math.round(screenWidth * 0.65);
  const CARD_HEIGHT = Math.round(CARD_WIDTH * (5 / 3)); // 3:5 aspect ratio
  const ITEM_WIDTH = CARD_WIDTH + 12; // card + horizontal margin
  const SECTION_HEIGHT = CARD_HEIGHT + 140; // card + header + dots + padding

  const bgUri = useMemo(
    () => items[activeIndex]?.spotlight_image || items[activeIndex]?.cover_image,
    [activeIndex, items],
  );

  // Auto-scroll
  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = setInterval(() => {
      const nextIndex = (useCarouselStore.getState().activeIndex + 1) % items.length;
      useCarouselStore.getState().setActiveIndex(nextIndex);
      scrollRef.current?.scrollTo({
        x: nextIndex * ITEM_WIDTH,
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

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / ITEM_WIDTH);
      const clampedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
      setActiveIndex(clampedIndex);
      // Restart auto-scroll after manual interaction
      startAutoScroll();
    },
    [ITEM_WIDTH, items.length, setActiveIndex, startAutoScroll],
  );

  const handleScrollBegin = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={{ height: SECTION_HEIGHT }} className="overflow-hidden">
      {/* Dynamic blurred background */}
      <DynamicBackground uri={bgUri} />
      <View className="absolute inset-0 bg-black/40" />
      <BlurView intensity={60} className="absolute inset-0" />

      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <Zap size={16} color="#f59e0b" fill="#f59e0b" />
          <Text className="text-white text-lg font-bold">Spotlight</Text>
        </View>
        <Text className="text-white/50 text-xs mt-0.5">Promoted</Text>
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: (screenWidth - CARD_WIDTH) / 2 - 6,
        }}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {items.map((item) => (
          <SpotlightCard
            key={item.campaign_id}
            item={item}
            cardWidth={CARD_WIDTH}
            cardHeight={CARD_HEIGHT}
          />
        ))}
      </ScrollView>

      {/* Dots */}
      <DotIndicator count={items.length} activeIndex={activeIndex} />
    </View>
  );
}
