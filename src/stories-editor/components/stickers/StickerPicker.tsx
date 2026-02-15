// ============================================================
// Instagram Stories Editor - Sticker Picker
// ============================================================

import React, { useState, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { EDITOR_COLORS, IMAGE_STICKER_PACKS } from "../../constants";
import {
  stickerPacks,
  type StickerPackKey,
} from "@/lib/constants/sticker-packs";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STICKER_SIZE = (SCREEN_WIDTH - 80) / 6;
const IMAGE_STICKER_SIZE = (SCREEN_WIDTH - 64) / 3;

interface StickerPickerProps {
  onSelectSticker: (source: string) => void;
  onSelectImageSticker?: (source: number, id: string) => void;
  onClose: () => void;
}

type PackKey = keyof typeof stickerPacks;
type StickerTab = "dvnt" | "ballroom" | PackKey | "all" | "gif";

const TWEMOJI_TABS: { id: StickerTab; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "✨" },
  { id: "faces", label: "Faces", icon: "😂" },
  { id: "gestures", label: "Gestures", icon: "👍" },
  { id: "hearts", label: "Hearts", icon: "❤️" },
  { id: "symbols", label: "Symbols", icon: "🔥" },
  { id: "food", label: "Food", icon: "🍕" },
  { id: "animals", label: "Animals", icon: "🦋" },
  { id: "nature", label: "Nature", icon: "🌈" },
  { id: "flags", label: "Flags", icon: "🚩" },
];

const ALL_TWEMOJI = Object.values(stickerPacks).flat();

export const StickerPicker: React.FC<StickerPickerProps> = ({
  onSelectSticker,
  onSelectImageSticker,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StickerTab>("dvnt");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs: { id: StickerTab; label: string; icon: string }[] = [
    ...IMAGE_STICKER_PACKS.map((pack) => ({
      id: pack.id as StickerTab,
      label: pack.name,
      icon: pack.icon,
    })),
    ...TWEMOJI_TABS,
    { id: "gif", label: "GIF", icon: "🎞️" },
  ];

  const activeImagePack = IMAGE_STICKER_PACKS.find((p) => p.id === activeTab);

  const twemojiStickers = useMemo(() => {
    if (activeImagePack || activeTab === "gif") return [];
    const packKey = activeTab as PackKey;
    const items =
      activeTab === "all" ? ALL_TWEMOJI : (stickerPacks[packKey] ?? []);
    if (!searchQuery.trim()) return items;
    return ALL_TWEMOJI; // search shows all
  }, [activeTab, searchQuery, activeImagePack]);

  const isTwemojiTab = !activeImagePack && activeTab !== "gif";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stickers</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search stickers..."
          placeholderTextColor={EDITOR_COLORS.textSecondary}
        />
      </View>

      {/* Tab Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            {tab.icon && <Text style={styles.tabIcon}>{tab.icon}</Text>}
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={styles.content}>
        {/* Image sticker packs (DVNT, Ballroom, etc.) */}
        {activeImagePack && (
          <BottomSheetFlatList
            data={activeImagePack.stickers}
            numColumns={3}
            keyExtractor={(item: {
              id: string;
              source: number;
              label: string;
            }) => item.id}
            renderItem={({
              item,
            }: {
              item: { id: string; source: number; label: string };
            }) => (
              <TouchableOpacity
                style={styles.imageStickerButton}
                onPress={() => {
                  if (onSelectImageSticker) {
                    onSelectImageSticker(item.source, item.id);
                  } else {
                    onSelectSticker(String(item.source));
                  }
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={item.source}
                  style={styles.imageStickerImage}
                  contentFit="contain"
                />
                <Text style={styles.imageStickerLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.imageStickerGrid}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Twemoji sticker grid (remote URLs rendered as images) */}
        {isTwemojiTab && (
          <BottomSheetFlatList
            data={twemojiStickers}
            numColumns={5}
            keyExtractor={(item: string, index: number) => `${item}-${index}`}
            renderItem={({ item }: { item: string }) => (
              <TouchableOpacity
                style={styles.twemojiButton}
                onPress={() => onSelectSticker(item)}
                activeOpacity={0.6}
              >
                <Image
                  source={{ uri: item }}
                  style={styles.twemojiImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.emojiGrid}
            showsVerticalScrollIndicator={false}
          />
        )}

        {activeTab === "gif" && (
          <View style={styles.gifPlaceholder}>
            <Text style={styles.gifPlaceholderText}>
              GIF search coming soon
            </Text>
            <Text style={styles.gifSubtext}>Powered by GIPHY</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    color: EDITOR_COLORS.text,
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    color: EDITOR_COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: EDITOR_COLORS.surfaceLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    color: EDITOR_COLORS.text,
    fontSize: 15,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: EDITOR_COLORS.surface,
    gap: 5,
  },
  tabActive: {
    backgroundColor: EDITOR_COLORS.primary,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  emojiGrid: {
    paddingBottom: 40,
  },
  twemojiButton: {
    width: (SCREEN_WIDTH - 64) / 5,
    height: (SCREEN_WIDTH - 64) / 5,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  twemojiImage: {
    width: "100%",
    height: "100%",
  },
  gifPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  gifPlaceholderText: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  gifSubtext: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 12,
    opacity: 0.6,
  },
  imageStickerGrid: {
    paddingBottom: 40,
  },
  imageStickerButton: {
    width: IMAGE_STICKER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  imageStickerImage: {
    width: IMAGE_STICKER_SIZE - 24,
    height: IMAGE_STICKER_SIZE - 24,
    borderRadius: 12,
  },
  imageStickerLabel: {
    color: EDITOR_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
});
