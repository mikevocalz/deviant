/**
 * EjectModal Component
 * Blocking modal shown when user is kicked or banned
 */

import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { UserX, Ban, X } from "lucide-react-native";
import { c } from "./styles";
import type { EjectPayload } from "../types";

interface EjectModalProps {
  visible: boolean;
  ejectReason?: EjectPayload;
  onDismiss: () => void;
}

export function EjectModal({ visible, ejectReason, onDismiss }: EjectModalProps) {
  const isKick = ejectReason?.action === "kick";
  const isBan = ejectReason?.action === "ban";

  const Icon = isBan ? Ban : UserX;
  const title = isBan ? "You've Been Banned" : "You've Been Removed";
  const description = isBan
    ? "You are no longer allowed to join this room."
    : "The host or a moderator has removed you from this room.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 items-center justify-center bg-black/70">
        <View className={`${c.cardGlass} w-[85%] max-w-sm p-6`}>
          {/* Icon */}
          <View className="items-center mb-4">
            <View className={`w-16 h-16 rounded-full items-center justify-center ${isBan ? "bg-destructive/20" : "bg-amber-500/20"}`}>
              <Icon size={32} color={isBan ? "#ef4444" : "#f59e0b"} />
            </View>
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-foreground text-center mb-2">
            {title}
          </Text>

          {/* Description */}
          <Text className="text-muted-foreground text-center mb-4">
            {description}
          </Text>

          {/* Reason (if provided) */}
          {ejectReason?.reason && (
            <View className="bg-muted/50 rounded-xl p-3 mb-4">
              <Text className="text-sm text-muted-foreground text-center">
                Reason: {ejectReason.reason}
              </Text>
            </View>
          )}

          {/* Ban expiry (if applicable) */}
          {isBan && ejectReason?.expiresAt && (
            <Text className="text-xs text-muted-foreground text-center mb-4">
              Ban expires: {new Date(ejectReason.expiresAt).toLocaleString()}
            </Text>
          )}

          {/* Dismiss Button */}
          <Pressable className={c.btnPrimary} onPress={onDismiss}>
            <Text className="text-primary-foreground font-semibold">
              {isBan ? "I Understand" : "Leave Room"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface ConfirmKickModalProps {
  visible: boolean;
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmKickModal({
  visible,
  username,
  onConfirm,
  onCancel,
}: ConfirmKickModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/70">
        <View className={`${c.cardGlass} w-[85%] max-w-sm p-6`}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground">Kick User</Text>
            <Pressable onPress={onCancel}>
              <X size={20} color="rgb(var(--muted-foreground))" />
            </Pressable>
          </View>

          <Text className="text-muted-foreground mb-6">
            Are you sure you want to kick <Text className="font-semibold text-foreground">{username}</Text> from the room? They can rejoin later.
          </Text>

          <View className="flex-row gap-3">
            <Pressable className={`${c.btnSecondary} flex-1`} onPress={onCancel}>
              <Text className="text-secondary-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable className={`${c.btnDestructive} flex-1`} onPress={onConfirm}>
              <Text className="text-white font-semibold">Kick</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ConfirmBanModalProps {
  visible: boolean;
  username: string;
  onConfirm: (durationMinutes?: number) => void;
  onCancel: () => void;
}

export function ConfirmBanModal({
  visible,
  username,
  onConfirm,
  onCancel,
}: ConfirmBanModalProps) {
  const [duration, setDuration] = React.useState<number | undefined>(undefined);

  const durations = [
    { label: "Permanent", value: undefined },
    { label: "1 hour", value: 60 },
    { label: "24 hours", value: 1440 },
    { label: "7 days", value: 10080 },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/70">
        <View className={`${c.cardGlass} w-[85%] max-w-sm p-6`}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground">Ban User</Text>
            <Pressable onPress={onCancel}>
              <X size={20} color="rgb(var(--muted-foreground))" />
            </Pressable>
          </View>

          <Text className="text-muted-foreground mb-4">
            Ban <Text className="font-semibold text-foreground">{username}</Text> from this room? They won't be able to rejoin.
          </Text>

          {/* Duration Selection */}
          <View className="flex-row flex-wrap gap-2 mb-6">
            {durations.map((d) => (
              <Pressable
                key={d.label}
                className={`px-3 py-2 rounded-full ${duration === d.value ? "bg-primary" : "bg-muted"}`}
                onPress={() => setDuration(d.value)}
              >
                <Text className={duration === d.value ? "text-primary-foreground" : "text-muted-foreground"}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row gap-3">
            <Pressable className={`${c.btnSecondary} flex-1`} onPress={onCancel}>
              <Text className="text-secondary-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              className={`${c.btnDestructive} flex-1`}
              onPress={() => onConfirm(duration)}
            >
              <Text className="text-white font-semibold">Ban</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface EndRoomModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndRoomModal({ visible, onConfirm, onCancel }: EndRoomModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/70">
        <View className={`${c.cardGlass} w-[85%] max-w-sm p-6`}>
          <Text className="text-lg font-bold text-foreground mb-2">End Room?</Text>
          <Text className="text-muted-foreground mb-6">
            This will end the call for everyone. This action cannot be undone.
          </Text>

          <View className="flex-row gap-3">
            <Pressable className={`${c.btnSecondary} flex-1`} onPress={onCancel}>
              <Text className="text-secondary-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable className={`${c.btnDestructive} flex-1`} onPress={onConfirm}>
              <Text className="text-white font-semibold">End Room</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
