import { View, ScrollView, StyleSheet } from "react-native"
import { SkeletonCircle, SkeletonText } from "@/components/ui/skeleton"

function StorySkeleton() {
  return (
    <View style={styles.storyItem}>
      <View style={styles.storyRing}>
        <SkeletonCircle size={60} />
      </View>
      <SkeletonText width={60} height={10} style={styles.username} />
    </View>
  )
}

export function StoriesBarSkeleton() {
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={false}
      >
        <StorySkeleton />
        <StorySkeleton />
        <StorySkeleton />
        <StorySkeleton />
        <StorySkeleton />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  storyItem: {
    alignItems: "center",
    padding: 8,
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    marginTop: 6,
  },
})
