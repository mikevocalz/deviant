/**
 * StickerPickerSheet — Bottom sheet wrapper for StickerSheetContent
 *
 * Opens as a modal sheet. When user selects a sticker/GIF/meme,
 * the URI is collected and passed back to the photo editor.
 */

import React, { memo, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useStickerStore } from "@/src/stickers/stores/sticker-store";
import { StickerSheetContent } from "./StickerSheetContent";

const SNAP_POINTS = ["70%", "92%"];

interface StickerPickerSheetProps {
  onDone: (stickers: string[]) => void;
  onDismiss?: () => void;
}

export const StickerPickerSheet = memo(function StickerPickerSheet({
  onDone,
  onDismiss,
}: StickerPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const isSheetOpen = useStickerStore((s) => s.isSheetOpen);
  const closeSheet = useStickerStore((s) => s.closeSheet);
  const selectedStickers = useStickerStore((s) => s.selectedStickers);
  const addSelectedSticker = useStickerStore((s) => s.addSelectedSticker);
  const clearSelectedStickers = useStickerStore(
    (s) => s.clearSelectedStickers,
  );

  const handleSelect = useCallback(
    (uri: string) => {
      addSelectedSticker(uri);
    },
    [addSelectedSticker],
  );

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const stickers = [...selectedStickers];
    closeSheet();
    clearSelectedStickers();
    onDone(stickers);
  }, [selectedStickers, closeSheet, clearSelectedStickers, onDone]);

  const handleClose = useCallback(() => {
    closeSheet();
    clearSelectedStickers();
    onDismiss?.();
  }, [closeSheet, clearSelectedStickers, onDismiss]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  if (!isSheetOpen) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={handleClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      style={{ zIndex: 999 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} hitSlop={12}>
          <X size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {selectedStickers.length > 0
            ? `${selectedStickers.length} selected`
            : "Add Stickers"}
        </Text>
        <Pressable
          onPress={handleDone}
          style={[
            styles.doneButton,
            selectedStickers.length === 0 && styles.doneButtonDisabled,
          ]}
          disabled={selectedStickers.length === 0}
          hitSlop={12}
        >
          <Check size={16} color="#fff" />
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      {/* Content */}
      <StickerSheetContent onSelect={handleSelect} />

      {/* Safe area bottom */}
      <View style={{ height: insets.bottom }} />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "rgba(15,15,15,0.98)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.8)",
  },
  doneButtonDisabled: {
    opacity: 0.3,
  },
  doneText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
