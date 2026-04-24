/**
 * RoomParticipantsSheet
 *
 * Live roster of a Sneaky Lynk room. Everyone can open it; moderation
 * actions (mute, remove) only show for the host and never against
 * themselves or the host row.
 *
 * Architecture decisions (see commit history for context):
 *   - Regular `BottomSheet` (not `BottomSheetModal`). Modal needed a
 *     `BottomSheetModalProvider` in the tree AND an imperative
 *     present()/dismiss() flow that was fighting the `visible` prop
 *     the parent owns. Regular BottomSheet with an `index` prop is
 *     straightforward and reliable.
 *   - NO `detached` — detaching the sheet with side margins was what
 *     rendered the close button visibly OUTSIDE the sheet on some
 *     devices (user-reported bug). Full-width sheet, rounded top
 *     corners, clean edge.
 *   - ALL hooks run every render. No early-return ABOVE hooks
 *     (the prior hook-order violation crashed the app).
 *   - Pressable rounded-square avatars nav to /profile/[username].
 *     Anonymous users are non-pressable and labeled "Anonymous".
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import {
  Crown,
  EyeOff,
  Mic,
  MicOff,
  Shield,
  Users,
  UserMinus,
  X,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import { useColorScheme } from "@/lib/hooks";
import type { VideoParticipant } from "./VideoGrid";
import { getSneakyUserLabel } from "./user-labels";

interface RoomParticipantsSheetProps {
  visible: boolean;
  participants: VideoParticipant[];
  localUserId: string;
  isHost: boolean;
  onDismiss: () => void;
  onMute: (userId: string) => void;
  onUnmute: (userId: string) => void;
  onRemove: (userId: string) => void;
}

const ROLE_ORDER: Record<string, number> = {
  host: 0,
  "co-host": 1,
  moderator: 2,
  participant: 3,
  speaker: 4,
  listener: 5,
};

interface RoleMeta {
  label: string;
  icon: (color: string) => React.ReactNode;
  useAccent: boolean; // true → solid cyan fill, false → hairline outline
}

function getRoleMeta(role: string): RoleMeta | null {
  switch (role) {
    case "host":
      return {
        label: "Host",
        icon: (c) => <Crown size={11} color={c} />,
        useAccent: true,
      };
    case "co-host":
      return {
        label: "Co-host",
        icon: (c) => <Shield size={11} color={c} />,
        useAccent: false,
      };
    case "moderator":
      return {
        label: "Mod",
        icon: (c) => <Shield size={11} color={c} />,
        useAccent: false,
      };
    default:
      // Listener / speaker / participant — no chip (their presence
      // IS their role, Zoom pattern). Returning null collapses the
      // pill entirely.
      return null;
  }
}

export function RoomParticipantsSheet({
  visible,
  participants,
  localUserId,
  isHost,
  onDismiss,
  onMute,
  onUnmute,
  onRemove,
}: RoomParticipantsSheetProps) {
  const { colors } = useColorScheme();
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);

  // Single snap at 72% — gives enough vertical room to see the hero
  // header + 6-8 rows without scrolling, and leaves a tasteful strip
  // of the room underneath so the user remembers where they are.
  const snapPoints = useMemo(() => ["72%"], []);

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const aOrder = ROLE_ORDER[a.role] ?? 99;
        const bOrder = ROLE_ORDER[b.role] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (!!a.isHandRaised !== !!b.isHandRaised) {
          return a.isHandRaised ? -1 : 1;
        }
        if (a.id === localUserId) return -1;
        if (b.id === localUserId) return 1;
        return getSneakyUserLabel(a.user).localeCompare(
          getSneakyUserLabel(b.user),
        );
      }),
    [participants, localUserId],
  );

  // Drive the sheet from `visible` via the ref — index={visible ? 0 : -1}
  // on first paint, and explicit snap/close calls on subsequent changes
  // so re-opens animate correctly.
  useEffect(() => {
    if (visible) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      if (!username) return;
      router.push(`/(protected)/profile/${username}` as any);
      onDismiss();
    },
    [onDismiss, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoParticipant }) => {
      const isSelf = item.id === localUserId;
      const isAnon = item.user.isAnonymous;
      const displayLabel = isAnon ? "Anonymous" : getSneakyUserLabel(item.user);
      const roleMeta = getRoleMeta(item.role);
      const canModerate = isHost && !isSelf && item.role !== "host";

      // Tappable avatar navigates to the user's profile — but ONLY
      // when not anonymous. Anonymous users are deliberately
      // unreachable from the roster.
      const avatar = isAnon ? (
        <View
          style={[
            styles.avatarAnon,
            {
              backgroundColor: `${colors.mutedForeground}14`,
              borderColor: colors.border,
            },
          ]}
        >
          <EyeOff size={20} color={colors.mutedForeground} />
        </View>
      ) : (
        <Avatar
          uri={item.user.avatar}
          username={item.user.username}
          size={44}
          variant="roundedSquare"
        />
      );

      return (
        <View
          style={[
            styles.row,
            {
              backgroundColor: `${colors.foreground}06`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.rowMain}>
            {isAnon ? (
              <View style={styles.avatarSlot}>{avatar}</View>
            ) : (
              <Pressable
                onPress={() => handleProfilePress(item.user.username)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.avatarSlot,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {avatar}
              </Pressable>
            )}

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    styles.username,
                    {
                      color: colors.foreground,
                      fontStyle: isAnon ? "italic" : "normal",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {displayLabel}
                  {isSelf ? (
                    <Text style={{ color: colors.mutedForeground }}>
                      {"  (You)"}
                    </Text>
                  ) : null}
                </Text>
              </View>

              <View style={styles.chipsRow}>
                {roleMeta ? (
                  <View
                    style={[
                      styles.chip,
                      roleMeta.useAccent
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          }
                        : {
                            backgroundColor: `${colors.primary}1f`,
                            borderColor: `${colors.primary}40`,
                          },
                    ]}
                  >
                    {roleMeta.icon(
                      roleMeta.useAccent
                        ? colors.primaryForeground
                        : colors.primary,
                    )}
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: roleMeta.useAccent
                            ? colors.primaryForeground
                            : colors.primary,
                        },
                      ]}
                    >
                      {roleMeta.label}
                    </Text>
                  </View>
                ) : null}

                {/* Hand-raised pill — only when raised. Accent pink so
                    it pulls attention in a long list. */}
                {item.isHandRaised ? (
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: `${colors.accent}1f`,
                        borderColor: `${colors.accent}40`,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.chipLabel, { color: colors.accent }]}
                    >
                      ✋ Hand up
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Mic status: Zoom pattern — absence = on. Only render the
                indicator when the mic is MUTED. Red chip draws the eye. */}
            {!item.isMicOn ? (
              <View
                style={[
                  styles.micChip,
                  {
                    backgroundColor: `${colors.destructive}1a`,
                    borderColor: `${colors.destructive}40`,
                  },
                ]}
              >
                <MicOff size={13} color={colors.destructive} />
              </View>
            ) : null}
          </View>

          {/* Moderation row — host-only, non-self, non-host-target. */}
          {canModerate ? (
            <View style={styles.modRow}>
              <Pressable
                onPress={() =>
                  item.isMicOn ? onMute(item.id) : onUnmute(item.id)
                }
                style={({ pressed }) => [
                  styles.modBtn,
                  {
                    backgroundColor: item.isMicOn
                      ? `${colors.destructive}14`
                      : `${colors.primary}14`,
                    borderColor: item.isMicOn
                      ? `${colors.destructive}40`
                      : `${colors.primary}40`,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {item.isMicOn ? (
                  <MicOff size={13} color={colors.destructive} />
                ) : (
                  <Mic size={13} color={colors.primary} />
                )}
                <Text
                  style={[
                    styles.modBtnLabel,
                    {
                      color: item.isMicOn
                        ? colors.destructive
                        : colors.primary,
                    },
                  ]}
                >
                  {item.isMicOn ? "Mute" : "Unmute"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onRemove(item.id)}
                style={({ pressed }) => [
                  styles.modBtn,
                  {
                    backgroundColor: `${colors.destructive}14`,
                    borderColor: `${colors.destructive}40`,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <UserMinus size={13} color={colors.destructive} />
                <Text
                  style={[
                    styles.modBtnLabel,
                    { color: colors.destructive },
                  ]}
                >
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    },
    [colors, handleProfilePress, isHost, localUserId, onMute, onRemove, onUnmute],
  );

  const keyExtractor = useCallback((item: VideoParticipant) => item.id, []);

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableOverDrag={false}
      onChange={(idx) => {
        // Parent owns `visible`. When the user drags down or taps the
        // backdrop, fire onDismiss so the parent clears its state.
        if (idx === -1) onDismiss();
      }}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.secondary,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
      }}
      handleIndicatorStyle={{
        backgroundColor: `${colors.foreground}30`,
        width: 44,
      }}
      style={{ zIndex: 9999, elevation: 9999 }}
    >
      {/* Hero header — count is the moment. Close X sits INSIDE the
          header row so it can never render outside the sheet. */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.heroCount,
              {
                color: colors.primary,
                fontVariant: ["tabular-nums"],
              },
            ]}
          >
            {participants.length}{" "}
            <Text
              style={[styles.heroCountSuffix, { color: colors.foreground }]}
            >
              in the room
            </Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isHost
              ? "Tap an avatar to view a profile. Mute or remove from here."
              : "Tap an avatar to view a profile."}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          style={[
            styles.closeBtn,
            {
              backgroundColor: `${colors.foreground}10`,
              borderColor: colors.border,
            },
          ]}
        >
          <X size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <BottomSheetFlatList
        data={sortedParticipants}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 28,
          paddingTop: 4,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={26} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              No one here yet.
            </Text>
          </View>
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  heroCount: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroCountSuffix: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  // Row
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarSlot: {
    width: 44,
    flexShrink: 0,
  },
  avatarAnon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  username: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  micChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Moderation row
  modRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  modBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modBtnLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Empty
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
