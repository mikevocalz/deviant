import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Eye, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useStoryViewers } from "@/lib/hooks/use-stories";
import { Avatar } from "@/components/ui/avatar";
import { LegendList } from "@/components/list";
import type { StoryViewer } from "@/lib/api/stories";

interface StoryViewersSheetProps {
  storyId: string | undefined;
  visible: boolean;
  onClose: () => void;
}

function formatViewedAt(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function ViewerRow({
  viewer,
  onPress,
}: {
  viewer: StoryViewer;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.viewerRow}>
      <Avatar
        uri={viewer.avatar}
        username={viewer.username}
        size={44}
        variant="roundedSquare"
      />
      <View style={styles.viewerInfo}>
        <Text style={styles.viewerUsername}>{viewer.username}</Text>
        <Text style={styles.viewerTime}>
          {formatViewedAt(viewer.viewedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export function StoryViewersSheet({
  storyId,
  visible,
  onClose,
}: StoryViewersSheetProps) {
  const router = useRouter();
  const { data: viewers = [], isLoading } = useStoryViewers(
    visible ? storyId : undefined,
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      onClose();
      setTimeout(() => {
        router.push(`/(protected)/profile/${username}`);
      }, 300);
    },
    [router, onClose],
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Eye size={18} color="#34A2DF" />
            <Text style={styles.headerTitle}>
              {viewers.length} {viewers.length === 1 ? "viewer" : "viewers"}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeButton}
          >
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#34A2DF" />
          </View>
        ) : viewers.length === 0 ? (
          <View style={styles.centered}>
            <Eye size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No viewers yet</Text>
          </View>
        ) : (
          <LegendList
            data={viewers}
            keyExtractor={(item) => String(item.userId)}
            renderItem={({ item }) => (
              <ViewerRow
                viewer={item}
                onPress={() => handleProfilePress(item.username)}
              />
            )}
            estimatedItemSize={64}
            recycleItems
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    minHeight: 200,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#34A2DF",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerUsername: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  viewerTime: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
