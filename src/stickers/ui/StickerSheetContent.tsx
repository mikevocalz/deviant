/**
 * StickerSheetContent — Tabbed sticker picker using local sticker packs
 *
 * Temporary: Uses Twemoji sticker packs from sticker-packs.ts
 * until Klipy API key is approved. Supports category tabs and search.
 */

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { stickerPacks } from "@/lib/constants/sticker-packs";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 12;
const GRID_GAP = 8;
const NUM_COLUMNS = 5;
const ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

type PackKey = keyof typeof stickerPacks;

const CATEGORIES: { key: PackKey | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "✨" },
  { key: "faces", label: "Faces", emoji: "😂" },
  { key: "gestures", label: "Gestures", emoji: "👍" },
  { key: "hearts", label: "Hearts", emoji: "❤️" },
  { key: "symbols", label: "Symbols", emoji: "🔥" },
  { key: "food", label: "Food", emoji: "🍕" },
  { key: "animals", label: "Animals", emoji: "🦋" },
  { key: "nature", label: "Nature", emoji: "🌈" },
  { key: "flags", label: "Flags", emoji: "🚩" },
];

// Build a flat list with category info for search
const ALL_ITEMS = Object.entries(stickerPacks).flatMap(([category, urls]) =>
  urls.map((url) => ({ url, category })),
);

// ── Main Component ─────────────────────────────────────

interface StickerSheetContentProps {
  onSelect: (uri: string) => void;
}

export const StickerSheetContent = memo(function StickerSheetContent({
  onSelect,
}: StickerSheetContentProps) {
  const [activeCategory, setActiveCategory] = useState<PackKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStickers = useMemo(() => {
    let items =
      activeCategory === "all"
        ? ALL_ITEMS
        : ALL_ITEMS.filter((item) => item.category === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = ALL_ITEMS.filter((item) =>
        item.category.toLowerCase().includes(q),
      );
    }

    return items.map((item) => item.url);
  }, [activeCategory, searchQuery]);

  const handleSelect = useCallback(
    (uri: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(uri);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <StickerGridItem uri={item} onPress={handleSelect} />
    ),
    [handleSelect],
  );

  const keyExtractor = useCallback(
    (item: string, index: number) => `${item}-${index}`,
    [],
  );

  return (
    <View style={styles.container}>
      {/* ── Category Tabs (horizontal scroll) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(cat.key);
                setSearchQuery("");
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={styles.tabEmoji}>{cat.emoji}</Text>
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <Search size={16} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stickers..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text.trim()) setActiveCategory("all");
          }}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <X size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
      </View>

      {/* ── Grid ── */}
      {filteredStickers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No stickers found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStickers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={30}
          windowSize={5}
        />
      )}
    </View>
  );
});

// ── Grid Item ──────────────────────────────────────────

const StickerGridItem = memo(function StickerGridItem({
  uri,
  onPress,
}: {
  uri: string;
  onPress: (uri: string) => void;
}) {
  return (
    <Pressable onPress={() => onPress(uri)} style={styles.gridItem}>
      <Image
        source={{ uri }}
        style={styles.gridImage}
        contentFit="contain"
        recyclingKey={uri}
        transition={100}
        cachePolicy="memory-disk"
      />
    </Pressable>
  );
});

// ── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(15,15,15,0.98)",
  },
  // Tabs
  tabBar: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "rgba(62, 164, 229, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(62, 164, 229, 0.3)",
  },
  tabEmoji: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
  },
  tabLabelActive: {
    color: "#fff",
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: GRID_PADDING,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    padding: 0,
  },
  // Grid
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 40,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
  },
});
