import { View, StyleSheet } from "react-native";
import {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
} from "@/components/ui/skeleton";

function MessageItemSkeleton() {
  return (
    <View style={styles.messageItem}>
      <SkeletonCircle size={56} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <SkeletonText width={100} height={16} />
          <SkeletonText width={24} height={12} />
        </View>
        <SkeletonText width={200} height={14} style={styles.preview} />
      </View>
    </View>
  );
}

export function MessagesSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Skeleton style={{ width: 24, height: 24, borderRadius: 12 }} />
        <SkeletonText width={100} height={18} />
        <Skeleton style={{ width: 24, height: 24, borderRadius: 12 }} />
      </View>

      <MessageItemSkeleton />
      <MessageItemSkeleton />
      <MessageItemSkeleton />
      <MessageItemSkeleton />
      <MessageItemSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    marginTop: 4,
  },
});
