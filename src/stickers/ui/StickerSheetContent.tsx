/**
 * StickerSheetContent — Tabbed sticker picker using local sticker packs
 *
 * Temporary: Uses Twemoji sticker packs from sticker-packs.ts
 * until Klipy API key is approved. Supports category tabs and search.
 */

import React, { memo, useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { LegendList } from "@/components/list";
import { Image } from "expo-image";
import { Asset } from "expo-asset";
import { Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import {
  stickerPacks,
  LOCAL_STICKER_MODULES,
  resolveLocalStickers,
} from "@/lib/constants/sticker-packs";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 12;
const GRID_GAP = 8;
const NUM_COLUMNS = 5;
const ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

type PackKey = keyof typeof stickerPacks;
type CategoryKey = "dvnt" | "ballroom" | PackKey | "all";

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "dvnt", label: "DVNT", emoji: "🔥" },
  { key: "ballroom", label: "Ballroom", emoji: "💃" },
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

// Build a flat list with category info for search (remote stickers only)
const ALL_ITEMS = Object.entries(stickerPacks).flatMap(([category, urls]) =>
  urls.map((url) => ({ url, category })),
);

// Sticker item: either a remote URL string or a local asset module number
type StickerItem =
  | { uri: string; isLocal: false }
  | { moduleId: number; isLocal: true };

// ── Main Component ─────────────────────────────────────

interface StickerSheetContentProps {
  onSelect: (uri: string) => void;
}

export const StickerSheetContent = memo(function StickerSheetContent({
  onSelect,
}: StickerSheetContentProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("dvnt");
  const [searchQuery, setSearchQuery] = useState("");
  const [localStickers, setLocalStickers] = useState<{
    dvnt: string[];
    ballroom: string[];
  } | null>(null);

  // Resolve local sticker assets to file URIs on mount
  useEffect(() => {
    resolveLocalStickers().then(setLocalStickers).catch(console.warn);
  }, []);

  const filteredStickers = useMemo((): StickerItem[] => {
    // Local pack tabs
    if (activeCategory === "dvnt" || activeCategory === "ballroom") {
      if (!localStickers) {
        // Not resolved yet — show module IDs for preview
        const modules = LOCAL_STICKER_MODULES[activeCategory];
        return modules.map((mod) => ({ moduleId: mod, isLocal: true }));
      }
      return localStickers[activeCategory].map((uri) => ({
        uri,
        isLocal: false,
      }));
    }

    // Remote sticker packs
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

    return items.map((item) => ({ uri: item.url, isLocal: false }));
  }, [activeCategory, searchQuery, localStickers]);

  const handleSelect = useCallback(
    (uri: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(uri);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: StickerItem }) => {
      if (item.isLocal) {
        return (
          <LocalStickerGridItem
            moduleId={item.moduleId}
            onPress={handleSelect}
          />
        );
      }
      return <StickerGridItem uri={item.uri} onPress={handleSelect} />;
    },
    [handleSelect],
  );

  const keyExtractor = useCallback(
    (item: StickerItem, index: number) =>
      item.isLocal ? `local-${item.moduleId}-${index}` : `${item.uri}-${index}`,
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
          const isLocalPack = cat.key === "dvnt" || cat.key === "ballroom";
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(cat.key);
                setSearchQuery("");
              }}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                isLocalPack && styles.tabLocal,
                isActive && isLocalPack && styles.tabLocalActive,
              ]}
            >
              <Text style={styles.tabEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                  isLocalPack && !isActive && styles.tabLabelLocal,
                ]}
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
          <Pressable onPress={() => setSearchQuery("")} hitSlop={12}>
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
        <LegendList
          data={filteredStickers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={{ gap: GRID_GAP, rowGap: GRID_GAP }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          recycleItems
          estimatedItemSize={ITEM_SIZE}
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

// Local asset sticker — uses require() module ID for display,
// resolves to file URI on press for the photo editor
const LocalStickerGridItem = memo(function LocalStickerGridItem({
  moduleId,
  onPress,
}: {
  moduleId: number;
  onPress: (uri: string) => void;
}) {
  const handlePress = useCallback(async () => {
    try {
      const asset = Asset.fromModule(moduleId);
      await asset.downloadAsync();
      if (asset.localUri) {
        onPress(asset.localUri);
      }
    } catch (e) {
      console.warn("[Stickers] Failed to resolve local sticker:", e);
    }
  }, [moduleId, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.gridItemLocal}>
      <Image
        source={moduleId}
        style={styles.gridImage}
        contentFit="contain"
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
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabActive: {
    backgroundColor: "rgba(62, 164, 229, 0.2)",
    borderColor: "rgba(62, 164, 229, 0.3)",
  },
  tabLocal: {
    backgroundColor: "rgba(255, 91, 252, 0.08)",
    borderColor: "rgba(255, 91, 252, 0.15)",
  },
  tabLocalActive: {
    backgroundColor: "rgba(255, 91, 252, 0.2)",
    borderColor: "rgba(255, 91, 252, 0.4)",
  },
  tabLabelLocal: {
    color: "rgba(255, 91, 252, 0.6)",
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
  gridItemLocal: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
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
