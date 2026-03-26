// ============================================================
// Instagram Stories Editor - Sticker Picker
// ============================================================

import React, { useMemo } from "react";
import {
  View,
  Pressable,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useEditorStore } from "../../stores/editor-store";
import { IMAGE_STICKER_PACKS } from "../../constants";
import {
  stickerPacks,
  type StickerPackKey,
} from "@/lib/constants/sticker-packs";
import {
  getItemImageUri,
  getItemPreviewUri,
  klipySearch,
  type KlipyItem,
} from "@/src/stickers/api/klipy";

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
const GIF_SKELETONS = Array.from({ length: 12 }, (_, index) => `gif-${index}`);

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
    { id: "gif", label: "GIFs", icon: "🎞️" },
  ];

  const activeImagePack = IMAGE_STICKER_PACKS.find((p) => p.id === activeTab);
  const isGifTab = activeTab === "gif";
  const activeImageStickers = useMemo(() => {
    if (!activeImagePack) return [];
    if (!searchQuery.trim()) return activeImagePack.stickers;

    const q = searchQuery.trim().toLowerCase();
    return activeImagePack.stickers.filter((sticker) =>
      sticker.label.toLowerCase().includes(q),
    );
  }, [activeImagePack, searchQuery]);

  const twemojiStickers = useMemo(() => {
    if (activeImagePack || activeTab === "gif") return [];
    const packKey = activeTab as PackKey;
    const items =
      activeTab === "all" ? ALL_TWEMOJI : (stickerPacks[packKey] ?? []);
    if (!searchQuery.trim()) return items;
    return ALL_TWEMOJI;
  }, [activeTab, searchQuery, activeImagePack]);

  const isTwemojiTab = !activeImagePack && activeTab !== "gif";
  const gifQuery = useQuery({
    queryKey: [
      "story-editor",
      "stickers",
      "klipy",
      "gifs",
      searchQuery.trim().toLowerCase(),
    ],
    queryFn: ({ signal }) => klipySearch("gifs", searchQuery, { signal }),
    enabled: isGifTab,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    placeholderData: (previous) => previous,
  });
  const gifItems = gifQuery.data?.results ?? [];

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
            placeholder={isGifTab ? "Search GIFs..." : "Search stickers..."}
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
          <ScrollView
            key={activeImagePack.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 40,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {activeImageStickers.map((item) => (
              <Pressable
                key={item.id}
                className="items-center justify-center p-2"
                style={{ width: imageStickerSize }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            ))}
          </ScrollView>
        )}

        {isTwemojiTab && (
          <FlatList
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectSticker(item);
                }}
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
          <FlatList
            data={
              gifQuery.isLoading && gifItems.length === 0
                ? GIF_SKELETONS
                : gifItems
            }
            numColumns={3}
            keyExtractor={(item: string | KlipyItem, index: number) =>
              typeof item === "string" ? item : `${item.id}-${index}`
            }
            renderItem={({ item }: { item: string | KlipyItem }) =>
              typeof item === "string" ? (
                <GifSkeletonItem width={imageStickerSize} />
              ) : (
                <GifGridItem
                  item={item}
                  width={imageStickerSize}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const uri = getItemImageUri(item, "gifs");
                    if (uri) {
                      onSelectSticker(uri);
                    }
                  }}
                />
              )
            }
            ListEmptyComponent={
              gifQuery.isError ? (
                <View className="flex-1 justify-center items-center gap-2 pt-12">
                  <Text className="text-neutral-300 text-base font-semibold">
                    GIF search is unavailable right now
                  </Text>
                  <Text className="text-neutral-500 text-xs text-center px-8">
                    {"Klipy didn't return results. Try again in a moment."}
                  </Text>
                </View>
              ) : (
                <View className="flex-1 justify-center items-center gap-2 pt-12">
                  <Text className="text-neutral-300 text-base font-semibold">
                    No GIFs found
                  </Text>
                  <Text className="text-neutral-500 text-xs text-center px-8">
                    Try another search term.
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              <View className="pb-10 pt-4 items-center">
                <Text className="text-neutral-500 text-[11px] font-medium">
                  Powered by Klipy
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 4 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const GifSkeletonItem = ({ width }: { width: number }) => (
  <View
    style={{
      width,
      height: width * 1.2,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.06)",
      marginBottom: 10,
    }}
  />
);

const GifGridItem = ({
  item,
  width,
  onPress,
}: {
  item: KlipyItem;
  width: number;
  onPress: () => void;
}) => {
  const previewUri = getItemPreviewUri(item, "gifs");

  return (
    <Pressable
      onPress={onPress}
      style={{
        width,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          height: width * 1.2,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <Image
          source={{ uri: previewUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
        />
      </View>
      <Text
        className="text-neutral-400 text-[11px] font-semibold mt-1"
        numberOfLines={1}
      >
        {item.title || item.content_description || "GIF"}
      </Text>
    </Pressable>
  );
};
