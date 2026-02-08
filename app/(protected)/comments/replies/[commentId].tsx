import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ArrowLeft, Send, Heart } from "lucide-react-native";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplies, useCreateComment } from "@/lib/hooks/use-comments";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import type { Comment } from "@/lib/types";
import { Avatar as UserAvatar } from "@/components/ui/avatar";
import { CommentLikeButton } from "@/components/comments/threaded-comment";

export default function RepliesScreen() {
  const { commentId, postId } = useLocalSearchParams<{
    commentId: string;
    postId?: string;
  }>();
  const router = useRouter();
  const { newComment: reply, setNewComment: setReply } = useCommentsStore();
  const user = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);
  const insets = useSafeAreaInsets();

  // Fetch replies from API - pass both commentId and postId
  const { data: replies = [], isLoading } = useReplies(
    commentId || "",
    postId || "",
  );
  const createCommentMutation = useCreateComment();

  const handleSend = async () => {
    if (!reply.trim() || !commentId) return;

    if (!postId) {
      showToast("error", "Error", "Cannot determine post ID for reply");
      return;
    }

    if (!user?.username) {
      showToast("error", "Error", "You must be logged in to reply");
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        post: postId,
        text: reply.trim(),
        parent: commentId,
        authorUsername: user.username,
        authorId: user.id,
      });
      setReply("");
      Keyboard.dismiss();
    } catch (error: any) {
      showToast("error", "Error", error?.message || "Failed to post reply");
    }
  };

  // Handle keyboard dismiss
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        // Clear reply state when keyboard is dismissed
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#333",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
          Comments
        </Text>
      </View>

      {/* Replies List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "#999" }}>Loading replies...</Text>
          </View>
        ) : !replies || replies.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "#999" }}>No replies yet</Text>
          </View>
        ) : (
          replies.map((item: Comment) => (
            <View key={item.id} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <UserAvatar
                  uri={item.avatar}
                  username={item.username}
                  size={36}
                  variant="roundedSquare"
                />
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{ fontWeight: "600", fontSize: 14, color: "#fff" }}
                    >
                      {item.username}
                    </Text>
                    <Text style={{ color: "#999", fontSize: 12 }}>
                      {item.timeAgo}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      marginTop: 4,
                      lineHeight: 20,
                      color: "#fff",
                    }}
                  >
                    {item.text}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                      marginTop: 8,
                    }}
                  >
                    <CommentLikeButton
                      postId={postId || ""}
                      commentId={item.id}
                      initialLikes={item.likes}
                      initialHasLiked={item.hasLiked}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: "#333",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Add a reply..."
            placeholderTextColor="#999"
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            enablesReturnKeyAutomatically={true}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 100,
              backgroundColor: "#1f1f1f",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: "#fff",
            }}
          />
          <Pressable
            onPress={handleSend}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#6366f1",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
