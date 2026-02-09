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
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { SheetHeader } from "@/components/ui/sheet-header";
import { Image } from "expo-image";
import { Send, Heart } from "lucide-react-native";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplies, useCreateComment } from "@/lib/hooks/use-comments";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import type { Comment } from "@/lib/types";
import { Avatar as UserAvatar } from "@/components/ui/avatar";
import { CommentLikeButton } from "@/components/comments/threaded-comment";
import { usersApi } from "@/lib/api/users";
import { useQuery } from "@tanstack/react-query";

export default function RepliesScreen() {
  const { commentId, postId } = useLocalSearchParams<{
    commentId: string;
    postId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { newComment: reply, setNewComment: setReply } = useCommentsStore();
  const user = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);
  const insets = useSafeAreaInsets();

  // @mention autocomplete state
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<TextInput>(null);

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

  // Extract unique commenters for @mention autocomplete (instant local results)
  const commenters = useMemo(() => {
    const seen = new Set<string>();
    const result: { username: string; avatar?: string }[] = [];
    for (const r of replies) {
      if (
        r.username &&
        !seen.has(r.username) &&
        r.username !== user?.username
      ) {
        seen.add(r.username);
        result.push({ username: r.username, avatar: r.avatar });
      }
    }
    return result;
  }, [replies, user?.username]);

  const mentionQuery = useMemo(() => {
    const before = reply.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, [reply, cursorPos]);

  // API-backed user search for @mentions (searches all users, not just commenters)
  const { data: apiMentionResults = [] } = useQuery({
    queryKey: ["users", "mention-search", mentionQuery],
    queryFn: async () => {
      if (!mentionQuery || mentionQuery.length < 1) return [];
      const result = await usersApi.searchUsers(mentionQuery.toLowerCase(), 8);
      return (result.docs || []).map((u: any) => ({
        username: u.username,
        avatar: u.avatar,
      }));
    },
    enabled: !!mentionQuery && mentionQuery.length >= 1,
    staleTime: 10_000,
  });

  // Merge local commenters + API results, deduplicated
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    if (!mentionQuery) return commenters.slice(0, 5);
    const seen = new Set<string>();
    const merged: { username: string; avatar?: string }[] = [];
    const localMatches = commenters.filter((c) =>
      c.username.toLowerCase().includes(mentionQuery.toLowerCase()),
    );
    for (const u of localMatches) {
      if (!seen.has(u.username)) {
        seen.add(u.username);
        merged.push(u);
      }
    }
    for (const u of apiMentionResults) {
      if (!seen.has(u.username) && u.username !== user?.username) {
        seen.add(u.username);
        merged.push(u);
      }
    }
    return merged.slice(0, 8);
  }, [mentionQuery, commenters, apiMentionResults, user?.username]);

  const handleInsertMention = useCallback(
    (username: string) => {
      const before = reply.slice(0, cursorPos);
      const after = reply.slice(cursorPos);
      const atIdx = before.lastIndexOf("@");
      const newBefore = before.slice(0, atIdx);
      const newText = `${newBefore}@${username} ${after}`;
      setReply(newText);
      setCursorPos(newBefore.length + username.length + 2);
      inputRef.current?.focus();
    },
    [reply, cursorPos, setReply],
  );

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

  // Hide default header — we render SheetHeader inline
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <SheetHeader title="Replies" onClose={() => router.back()} />
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
                    {item.text
                      .split(/(@\w+)/g)
                      .map((part: string, i: number) =>
                        part.startsWith("@") ? (
                          <Text
                            key={i}
                            onPress={() =>
                              router.push(
                                `/(protected)/profile/${part.slice(1)}` as any,
                              )
                            }
                            style={{ color: "#3EA4E5", fontWeight: "600" }}
                          >
                            {part}
                          </Text>
                        ) : (
                          <Text key={i}>{part}</Text>
                        ),
                      )}
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
            borderTopWidth: 1,
            borderTopColor: "#333",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          {/* @mention autocomplete dropdown */}
          {mentionSuggestions.length > 0 && (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 12,
                marginBottom: 8,
                maxHeight: 180,
                overflow: "hidden",
              }}
            >
              <Text
                style={{
                  color: "#666",
                  fontSize: 11,
                  paddingHorizontal: 12,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                Mention a user
              </Text>
              {mentionSuggestions.map((u) => (
                <Pressable
                  key={u.username}
                  onPress={() => handleInsertMention(u.username)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Image
                    source={{
                      uri:
                        u.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=1a1a1a&color=fff`,
                    }}
                    style={{ width: 28, height: 28, borderRadius: 6 }}
                  />
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}
                  >
                    {u.username}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TextInput
              ref={inputRef}
              value={reply}
              onChangeText={setReply}
              onSelectionChange={(e) =>
                setCursorPos(e.nativeEvent.selection.end)
              }
              placeholder="Add a reply... (@ to mention)"
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
