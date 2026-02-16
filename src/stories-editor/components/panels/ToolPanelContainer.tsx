// ============================================================
// ToolPanelContainer — @gorhom/bottom-sheet powered tool panels
// ============================================================
// Uses BottomSheetModal for native-feeling slide-up panels.
// Visibility controlled via `visible` prop — auto-presents/dismisses.
// ============================================================

import React, { useCallback, useEffect, useRef, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import BottomSheet, {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";

interface ToolPanelContainerProps {
  visible: boolean;
  onDismiss: () => void;
  /** Panel height as percentage of screen (0-1). Default 0.42 */
  heightRatio?: number;
  children: React.ReactNode;
}

export const ToolPanelContainer: React.FC<ToolPanelContainerProps> = React.memo(
  ({ visible, onDismiss, heightRatio = 0.42, children }) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const { height: screenH } = useWindowDimensions();

    const snapPoints = useMemo(
      () => [Math.round(screenH * heightRatio)],
      [screenH, heightRatio],
    );

    useEffect(() => {
      if (visible) {
        sheetRef.current?.present();
      } else {
        sheetRef.current?.dismiss();
      }
    }, [visible]);

    const handleDismiss = useCallback(() => {
      onDismiss();
    }, [onDismiss]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: "#1a1a1a",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
        handleIndicatorStyle={{
          backgroundColor: "#555",
          width: 36,
          height: 4,
        }}
        handleStyle={{
          paddingTop: 10,
          paddingBottom: 6,
        }}
      >
        <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ToolPanelContainer.displayName = "ToolPanelContainer";
