/**
 * StickerSheetContent — Tabbed sticker picker (Stickers | GIFs | Memes)
 *
 * Powered by Klipy API. Renders inside a bottom sheet.
 * Selected items are added to the editor's sticker array as remote URIs.
 */

import React, { memo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Keyboard,
} from "react-native";
import { Image } from "expo-image";
import { Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useStickerStore } from "@/src/stickers/stores/sticker-store";
import {
  useKlipySearch,
  useKlipyAutocomplete,
} from "@/src/stickers/hooks/useKlipySearch";
import {
  getItemPreviewUri,
  getItemImageUri,
  type KlipyItem,
  type KlipyTab,
} from "@/src/stickers/api/klipy";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 12;
const GRID_GAP = 6;
const NUM_COLUMNS = 4;
const ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

const TABS: { key: KlipyTab; label: string }[] = [
  { key: "stickers", label: "Stickers" },
  { key: "gifs", label: "GIFs" },
  { key: "memes", label: "Memes" },
];

// ── Main Component ─────────────────────────────────────

interface StickerSheetContentProps {
  onSelect: (uri: string) => void;
}

export const StickerSheetContent = memo(function StickerSheetContent({
  onSelect,
}: StickerSheetContentProps) {
  const activeTab = useStickerStore((s) => s.activeTab);
  const setActiveTab = useStickerStore((s) => s.setActiveTab);
  const searchInput = useStickerStore((s) => s.searchInput);
  const setSearchInput = useStickerStore((s) => s.setSearchInput);
  const clearSearch = useStickerStore((s) => s.clearSearch);
  const addRecent = useStickerStore((s) => s.addRecent);

  const { items, isLoading, isFetching, isTrending } = useKlipySearch();
  const { suggestions } = useKlipyAutocomplete();

  const inputRef = useRef<TextInput>(null);

  const handleSelect = useCallback(
    (item: KlipyItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = getItemImageUri(item, activeTab);
      if (uri) {
        addRecent(uri);
        onSelect(uri);
      }
    },
    [activeTab, addRecent, onSelect],
  );

  const handleSuggestionTap = useCallback(
    (suggestion: string) => {
      setSearchInput(suggestion);
      Keyboard.dismiss();
    },
    [setSearchInput],
  );

  const renderItem = useCallback(
    ({ item }: { item: KlipyItem }) => (
      <StickerGridItem
        item={item}
        tab={activeTab}
        onPress={handleSelect}
      />
    ),
    [activeTab, handleSelect],
  );

  const keyExtractor = useCallback((item: KlipyItem) => item.id, []);

  const showSuggestions =
    searchInput.trim().length >= 2 && suggestions.length > 0;

  return (
    <View style={styles.container}>
      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.key);
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <Search size={16} color="rgba(255,255,255,0.4)" />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={`Search ${activeTab}...`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchInput.length > 0 && (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <X size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
      </View>

      {/* ── Autocomplete Suggestions ── */}
      {showSuggestions && (
        <View style={styles.suggestionsRow}>
          {suggestions.slice(0, 5).map((s) => (
            <Pressable
              key={s}
              onPress={() => handleSuggestionTap(s)}
              style={styles.suggestionChip}
            >
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Grid ── */}
      {isLoading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {isTrending ? "Loading trending..." : "No results found"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={20}
          windowSize={5}
          ListFooterComponent={
            isFetching ? (
              <ActivityIndicator
                size="small"
                color="rgba(255,255,255,0.3)"
                style={{ paddingVertical: 16 }}
              />
            ) : null
          }
        />
      )}

      {/* ── Klipy Attribution ── */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>Powered by Klipy</Text>
      </View>
    </View>
  );
});

// ── Grid Item ──────────────────────────────────────────

const StickerGridItem = memo(function StickerGridItem({
  item,
  tab,
  onPress,
}: {
  item: KlipyItem;
  tab: KlipyTab;
  onPress: (item: KlipyItem) => void;
}) {
  const previewUri = getItemPreviewUri(item, tab);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={styles.gridItem}
    >
      <Image
        source={{ uri: previewUri }}
        style={styles.gridImage}
        contentFit={tab === "stickers" ? "contain" : "cover"}
        recyclingKey={item.id}
        transition={150}
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
    flexDirection: "row",
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
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
    marginBottom: 4,
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
  // Suggestions
  suggestionsRow: {
    flexDirection: "row",
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 6,
    gap: 6,
    flexWrap: "nowrap",
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    maxWidth: 120,
  },
  suggestionText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
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
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
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
  // Attribution
  attribution: {
    paddingVertical: 6,
    alignItems: "center",
  },
  attributionText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
  },
});
