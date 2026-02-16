"use client";

import { useCallback, useRef, useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";

const SNAP_POINTS = ["90%"];

export default function CommentsLayout() {
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);

  // Open sheet on mount
  useEffect(() => {
    // Small delay so the transparent modal is fully mounted before animating
    const t = setTimeout(() => sheetRef.current?.snapToIndex(0), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={handleClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: "#fff", width: 48 }}
      backgroundStyle={{ backgroundColor: "#000" }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <Slot />
    </BottomSheet>
  );
}
