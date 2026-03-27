/**
 * Eject Modal Component
 * Shown when user is kicked or banned from a room
 */

import { useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { ShieldX, Ban } from "lucide-react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import type { EjectPayload } from "../types";

interface EjectModalProps {
  visible: boolean;
  payload: EjectPayload | null;
  onDismiss: () => void;
}

export function EjectModal({ visible, payload, onDismiss }: EjectModalProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const isKick = payload?.action === "kick";
  const isBan = payload?.action === "ban";

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onDismiss();
    },
    [onDismiss],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
        pressBehavior="none"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose={false}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      backgroundStyle={{
        backgroundColor: "#1a1a2e",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: "rgba(255,255,255,0.3)",
        width: 36,
      }}
    >
      <BottomSheetView className="px-6 pb-10 pt-2 items-center">
        {/* Icon */}
        <View
          className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
            isBan ? "bg-destructive/20" : "bg-orange-500/20"
          }`}
        >
          {isBan ? (
            <Ban size={40} color="#F05252" />
          ) : (
            <ShieldX size={40} color="#F97316" />
          )}
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-foreground mb-2">
          {isBan ? "You've Been Banned" : "You've Been Removed"}
        </Text>

        {/* Description */}
        <Text className="text-muted-foreground text-center mb-2">
          {isBan
            ? "You have been banned from this room and cannot rejoin."
            : "A moderator has removed you from this room."}
        </Text>

        {/* Reason */}
        {payload?.reason && (
          <View className="bg-secondary rounded-xl px-4 py-3 w-full mb-4">
            <Text className="text-xs text-muted-foreground mb-1">Reason:</Text>
            <Text className="text-sm text-foreground">{payload.reason}</Text>
          </View>
        )}

        {/* Dismiss Button */}
        <Pressable
          onPress={onDismiss}
          className="bg-primary w-full py-4 rounded-full items-center mt-2"
        >
          <Text className="text-white font-semibold text-base">Leave Room</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
}
