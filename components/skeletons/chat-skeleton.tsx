import { View, StyleSheet } from "react-native"
import { Skeleton, SkeletonCircle, SkeletonText } from "@/components/ui/skeleton"

function MessageBubbleSkeleton({ isMe }: { isMe: boolean }) {
  return (
    <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
      <SkeletonText width={isMe ? 140 : 180} height={14} />
      <SkeletonText width={40} height={10} style={styles.messageTime} />
    </View>
  )
}

export function ChatSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Skeleton width={24} height={24} borderRadius={12} />
        <View style={styles.headerProfile}>
          <SkeletonCircle size={40} />
          <View style={styles.headerInfo}>
            <SkeletonText width={100} height={14} />
            <SkeletonText width={60} height={12} style={styles.headerStatus} />
          </View>
        </View>
      </View>

      <View style={styles.messagesList}>
        <MessageBubbleSkeleton isMe={false} />
        <MessageBubbleSkeleton isMe={true} />
        <MessageBubbleSkeleton isMe={false} />
        <MessageBubbleSkeleton isMe={true} />
        <MessageBubbleSkeleton isMe={false} />
      </View>

      <View style={styles.inputContainer}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={1} height={40} borderRadius={20} style={styles.input} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerStatus: {
    marginTop: 4,
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: "80%",
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(62,164,229,0.2)",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1a1a",
  },
  messageTime: {
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
  },
})
