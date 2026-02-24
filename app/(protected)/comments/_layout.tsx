"use client";

import { useCallback, useRef } from "react";
import { Slot, useRouter } from "expo-router";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";

const SNAP_POINTS = ["92%"];

export default function CommentsLayout() {
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);

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
      index={0}
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
