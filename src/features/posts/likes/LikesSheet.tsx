/**
 * LikesSheet — Gorhom BottomSheet showing users who liked a post.
 *
 * - Snaps to 50% only (no full-screen overdrag)
 * - Sticky header with "Likes" title and close button
 * - Tappable rows navigate to user profile
 * - Uses usePostLikers TanStack Query hook
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { X, Heart } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui/avatar";
import { usePostLikers } from "@/lib/hooks/use-post-likers";
import { useColorScheme } from "@/lib/hooks";
import type { PostLiker } from "@/lib/api/likes";

interface LikesSheetProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatLikedAt(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function LikerRow({
  liker,
  onPress,
}: {
  liker: PostLiker;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.likerRow}>
      <Avatar
        uri={liker.avatar}
        username={liker.username}
        size={44}
        variant="roundedSquare"
      />
      <View style={styles.likerInfo}>
        <Text style={styles.likerUsername} numberOfLines={1}>
          {liker.username}
        </Text>
        {liker.displayName !== liker.username && (
          <Text style={styles.likerDisplayName} numberOfLines={1}>
            {liker.displayName}
          </Text>
        )}
      </View>
      <Text style={styles.likerTime}>{formatLikedAt(liker.likedAt)}</Text>
    </Pressable>
  );
}

export function LikesSheet({ postId, isOpen, onClose }: LikesSheetProps) {
  const router = useRouter();
  const { colors } = useColorScheme();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%"], []);

  const { data: likers = [], isLoading } = usePostLikers(postId, isOpen);

  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [isOpen]);

  const handleProfilePress = useCallback(
    (username: string) => {
      onClose();
      setTimeout(() => {
        router.push(`/(protected)/profile/${username}` as any);
      }, 300);
    },
    [router, onClose],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
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

  const renderItem = useCallback(
    ({ item }: { item: PostLiker }) => (
      <LikerRow
        liker={item}
        onPress={() => handleProfilePress(item.username)}
      />
    ),
    [handleProfilePress],
  );

  const keyExtractor = useCallback(
    (item: PostLiker) => String(item.userId),
    [],
  );

  if (!isOpen) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableOverDrag={false}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.card,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.mutedForeground,
        width: 40,
      }}
      style={styles.sheetContainer}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Heart size={18} color="#FF5BFC" fill="#FF5BFC" />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Likes
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <X size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#FF5BFC" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading likes...
          </Text>
        </View>
      ) : likers.length === 0 ? (
        <View style={styles.centered}>
          <Heart size={32} color="rgba(255,255,255,0.2)" />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No likes yet
          </Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={likers}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    marginHorizontal: 16,
    overflow: "hidden",
    borderRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  likerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  likerInfo: {
    flex: 1,
  },
  likerUsername: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  likerDisplayName: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
  },
  likerTime: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 16,
  },
});
