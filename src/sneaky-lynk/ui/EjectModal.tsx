/**
 * Eject Modal Component
 * Shown when user is kicked or banned from a room
 */

import { View, Text, Pressable, Modal } from "react-native";
import { ShieldX, Ban } from "lucide-react-native";
import type { EjectPayload } from "../types";

interface EjectModalProps {
  visible: boolean;
  payload: EjectPayload | null;
  onDismiss: () => void;
}

export function EjectModal({ visible, payload, onDismiss }: EjectModalProps) {
  const isKick = payload?.action === "kick";
  const isBan = payload?.action === "ban";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <View className="bg-card w-full max-w-sm rounded-3xl p-6 items-center border border-border">
          {/* Icon */}
          <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
            isBan ? "bg-destructive/20" : "bg-orange-500/20"
          }`}>
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
            <Text className="text-white font-semibold text-base">
              Leave Room
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
