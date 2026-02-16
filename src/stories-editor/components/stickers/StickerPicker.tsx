// ============================================================
// Instagram Stories Editor - Sticker Picker
// ============================================================

import React, { useMemo } from "react";
import {
  View,
  Pressable,
  Text,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { Search } from "lucide-react-native";
import { useEditorStore } from "../../stores/editor-store";
import { IMAGE_STICKER_PACKS } from "../../constants";
import {
  stickerPacks,
  type StickerPackKey,
} from "@/lib/constants/sticker-packs";

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
  const { width: screenWidth } = useWindowDimensions();
  const imageStickerSize = (screenWidth - 64) / 3;

  const activeTab = useEditorStore((s) => s.stickerActiveTab) as StickerTab;
  const setActiveTab = useEditorStore((s) => s.setStickerActiveTab);
  const searchQuery = useEditorStore((s) => s.stickerSearchQuery);
  const setSearchQuery = useEditorStore((s) => s.setStickerSearchQuery);

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
    return ALL_TWEMOJI;
  }, [activeTab, searchQuery, activeImagePack]);

  const isTwemojiTab = !activeImagePack && activeTab !== "gif";

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 py-3">
        <Text className="text-white text-xl font-bold">Stickers</Text>
        <Pressable onPress={onClose}>
          <Text className="text-blue-500 text-base font-semibold">Done</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View className="px-5 mb-3">
        <View className="flex-row items-center bg-neutral-800 rounded-xl px-4 py-2.5 gap-2">
          <Search size={16} color="#8E8E93" strokeWidth={2} />
          <TextInput
            className="flex-1 text-white text-[15px]"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search stickers..."
            placeholderTextColor="#8E8E93"
          />
        </View>
      </View>

      {/* Tab Selector — compact 36dp height, horizontally scrollable */}
      <View style={{ height: 36, marginBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 6,
            alignItems: "center",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                className={`flex-row items-center h-[30px] px-3 rounded-full gap-1 ${
                  isActive ? "bg-blue-500" : "bg-neutral-800"
                }`}
                onPress={() => setActiveTab(tab.id)}
              >
                {tab.icon ? (
                  <Text className="text-[13px]">{tab.icon}</Text>
                ) : null}
                <Text
                  className={`text-xs font-semibold ${
                    isActive ? "text-white" : "text-neutral-400"
                  }`}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View className="flex-1 px-3">
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
              <Pressable
                className="items-center justify-center p-2"
                style={{ width: imageStickerSize }}
                onPress={() => {
                  if (onSelectImageSticker) {
                    onSelectImageSticker(item.source, item.id);
                  } else {
                    onSelectSticker(String(item.source));
                  }
                }}
              >
                <Image
                  source={item.source}
                  style={{
                    width: imageStickerSize - 24,
                    height: imageStickerSize - 24,
                    borderRadius: 12,
                  }}
                  contentFit="contain"
                />
                <Text
                  className="text-neutral-400 text-[11px] font-semibold mt-1 text-center"
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {isTwemojiTab && (
          <BottomSheetFlatList
            data={twemojiStickers}
            numColumns={5}
            keyExtractor={(item: string, index: number) => `${item}-${index}`}
            renderItem={({ item }: { item: string }) => (
              <Pressable
                className="justify-center items-center p-2"
                style={{
                  width: (screenWidth - 64) / 5,
                  height: (screenWidth - 64) / 5,
                }}
                onPress={() => onSelectSticker(item)}
              >
                <Image
                  source={{ uri: item }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {activeTab === "gif" && (
          <View className="flex-1 justify-center items-center gap-2">
            <Text className="text-neutral-400 text-base font-semibold">
              GIF search coming soon
            </Text>
            <Text className="text-neutral-400 text-xs opacity-60">
              Powered by GIPHY
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
