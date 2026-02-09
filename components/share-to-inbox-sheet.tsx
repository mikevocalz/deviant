import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { X, Send, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/ui/avatar";
import { LegendList } from "@/components/list";
import { messagesApiClient } from "@/lib/api/messages";
import { useChatStore, type SharedPostContext } from "@/lib/stores/chat-store";
import { useUIStore } from "@/lib/stores/ui-store";
import type { Conversation } from "@/lib/api/messages";

interface ShareToInboxSheetProps {
  visible: boolean;
  onClose: () => void;
  post: {
    id: string;
    authorUsername: string;
    authorAvatar: string;
    caption?: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  } | null;
}

export function ShareToInboxSheet({
  visible,
  onClose,
  post,
}: ShareToInboxSheetProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const sendSharedPost = useChatStore((s) => s.sendSharedPost);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSendingTo(null);
      return;
    }
    setIsLoading(true);
    messagesApiClient
      .getConversations()
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setIsLoading(false));
  }, [visible]);

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.user.username.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const handleSend = useCallback(
    async (conversation: Conversation) => {
      if (!post || sendingTo) return;
      setSendingTo(conversation.id);

      const sharedPost: SharedPostContext = {
        postId: post.id,
        authorUsername: post.authorUsername,
        authorAvatar: post.authorAvatar,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
      };

      try {
        await sendSharedPost(conversation.id, sharedPost);
        showToast("success", "Sent", `Post shared with ${conversation.user.username}`);
        onClose();
      } catch {
        showToast("error", "Error", "Failed to share post");
      } finally {
        setSendingTo(null);
      }
    },
    [post, sendSharedPost, showToast, onClose, sendingTo],
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Share to...</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#34A2DF" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </Text>
          </View>
        ) : (
          <LegendList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSend(item)}
                disabled={!!sendingTo}
                style={styles.conversationRow}
              >
                <Avatar
                  uri={item.user.avatar}
                  username={item.user.username}
                  size={44}
                  variant="roundedSquare"
                />
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationUsername}>
                    {item.user.username}
                  </Text>
                  <Text style={styles.conversationLastMsg} numberOfLines={1}>
                    {item.lastMessage || "No messages yet"}
                  </Text>
                </View>
                {sendingTo === item.id ? (
                  <ActivityIndicator size="small" color="#3EA4E5" />
                ) : (
                  <View style={styles.sendButton}>
                    <Send size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
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
    maxHeight: "70%",
    minHeight: 300,
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
  headerTitle: {
    fontSize: 18,
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationUsername: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  conversationLastMsg: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3EA4E5",
    alignItems: "center",
    justifyContent: "center",
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
