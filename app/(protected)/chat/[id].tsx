import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  ArrowLeft,
  Send,
  ImageIcon,
  X,
  Play,
  MessageCircle,
} from "lucide-react-native";
import { EmptyState } from "@/components/ui/empty-state";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useChatStore,
  Message,
  MediaAttachment,
} from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import { ChatSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import * as ImagePicker from "expo-image-picker";
import { MediaPreviewModal } from "@/components/media-preview-modal";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useTypingIndicator } from "@/lib/hooks/use-typing-indicator";
import { TypingIndicator } from "@/components/chat/typing-indicator";

// Empty array - messages will come from backend
const emptyMessages: Message[] = [];

function renderMessageText(
  text: string,
  onMentionPress: (username: string) => void,
) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const username = part.slice(1);
      return (
        <Text
          key={index}
          onPress={() => onMentionPress(username)}
          className="text-primary font-semibold"
        >
          {part}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

interface MediaMessageProps {
  media: MediaAttachment;
  onPress: () => void;
}

function MediaMessage({ media, onPress }: MediaMessageProps) {
  const player = useVideoPlayer(
    media.type === "video" ? media.uri : "",
    (p) => {
      p.loop = false;
    },
  );

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 200,
        height: 200,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 8,
        backgroundColor: "#222",
      }}
    >
      {media.type === "image" ? (
        <Image
          source={{ uri: media.uri }}
          style={{ width: 200, height: 200 }}
          contentFit="cover"
        />
      ) : (
        <View className="w-full h-full relative">
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls={false}
          />
          <View className="absolute inset-0 justify-center items-center bg-black/30">
            <LinearGradient
              colors={[
                "rgba(52,162,223,0.8)",
                "rgba(138,64,207,0.8)",
                "rgba(255,91,252,0.8)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-11 h-11 rounded-full justify-center items-center"
            >
              <Play size={20} color="#fff" fill="#fff" />
            </LinearGradient>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chatId = id || "1";
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    mentionQuery,
    showMentions,
    setCursorPosition,
    insertMention,
    pendingMedia,
    setPendingMedia,
  } = useChatStore();

  const chatMessages = messages[chatId] || emptyMessages;
  const currentUser = useAuthStore((s) => s.user);

  // Chat recipient info (passed via params or loaded from conversation)
  // For now, parse from chatId which might be "username" format or load from conversation
  const [recipient, setRecipient] = useState<{
    id: string;
    username: string;
    name: string;
    avatar: string;
  } | null>(null);

  // Load recipient info from chatId (could be username or conversation id)
  useEffect(() => {
    // TODO: Load from conversation API when backend is ready
    // For now, use chatId as username placeholder
    setRecipient({
      id: chatId,
      username: chatId,
      name: chatId,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(chatId)}&background=3EA4E5&color=fff`,
    });
  }, [chatId]);

  // Get toast function
  const showToast = useUIStore((s) => s.showToast);

  // Prevent self-messaging
  useEffect(() => {
    if (currentUser && recipient && currentUser.id === recipient.id) {
      showToast("error", "Error", "You cannot message yourself");
      router.back();
    }
  }, [currentUser, recipient, router, showToast]);

  // Typing indicator
  const { typingUsers, handleInputChange: handleTypingChange } =
    useTypingIndicator({ conversationId: chatId });

  const isRecipientTyping = typingUsers.length > 0;

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages.length]);

  const {
    previewMedia,
    showPreviewModal,
    setPreviewMedia,
    setShowPreviewModal,
  } = useFeedPostUIStore();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.chat;

  useEffect(() => {
    const loadChat = async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setScreenLoading("chat", false);
    };
    loadChat();
  }, [setScreenLoading]);

  // Mention suggestions - show the chat recipient when typing @
  const filteredUsers = useMemo(() => {
    if (!recipient) return [];

    // Only show recipient as mentionable user in DM
    const recipientUser = {
      id: recipient.id,
      username: recipient.username,
      name: recipient.name,
      avatar: recipient.avatar,
    };

    if (!mentionQuery) return [recipientUser];

    // Filter by query
    if (
      recipientUser.username
        .toLowerCase()
        .includes(mentionQuery.toLowerCase()) ||
      recipientUser.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ) {
      return [recipientUser];
    }

    return [];
  }, [mentionQuery, recipient]);

  const handleSend = useCallback(() => {
    if (!currentMessage.trim() && !pendingMedia) return;

    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    sendMessage(chatId);
  }, [chatId, currentMessage, sendMessage, sendButtonScale, pendingMedia]);

  const handleMentionSelect = useCallback(
    (username: string) => {
      insertMention(username);
      inputRef.current?.focus();
    },
    [insertMention],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      setCurrentMessage(text);
      handleTypingChange(text); // Trigger typing indicator
    },
    [setCurrentMessage, handleTypingChange],
  );

  const handleSelectionChange = useCallback(
    (event: { nativeEvent: { selection: { start: number; end: number } } }) => {
      setCursorPosition(event.nativeEvent.selection.end);
    },
    [setCursorPosition],
  );

  const handleMentionPress = useCallback(
    (username: string) => {
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  const handleProfilePress = useCallback(() => {
    if (recipient) {
      router.push(`/(protected)/profile/${recipient.username}`);
    }
  }, [router, recipient]);

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === "video";

      if (isVideo && asset.duration && asset.duration > 60000) {
        showToast(
          "error",
          "Video too long",
          "Please select a video under 60 seconds.",
        );
        return;
      }

      const media: MediaAttachment = {
        type: isVideo ? "video" : "image",
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        duration: asset.duration ?? undefined,
      };
      setPendingMedia(media);
    }
  }, [setPendingMedia]);

  const handleMediaPreview = useCallback(
    (media: MediaAttachment) => {
      setPreviewMedia({ type: media.type, uri: media.uri });
      setShowPreviewModal(true);
    },
    [setPreviewMedia, setShowPreviewModal],
  );

  const handleClosePreview = useCallback(() => {
    setShowPreviewModal(false);
    setPreviewMedia(null);
  }, [setShowPreviewModal, setPreviewMedia]);

  const canSend = currentMessage.trim() || pendingMedia;

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ChatSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleProfilePress}
            className="flex-row items-center gap-3 flex-1"
          >
            <Image
              source={{ uri: recipient?.avatar || "" }}
              className="w-10 h-10 rounded-full"
            />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">
                {recipient?.username || "Loading..."}
              </Text>
              <Text className="text-xs text-muted-foreground">Active now</Text>
            </View>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={chatMessages}
          extraData={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 gap-2"
          inverted={false}
          renderItem={({ item }) => (
            <View
              className={`rounded-2xl mb-2 ${
                item.sender === "me" ? "self-end" : "self-start"
              }`}
              style={{ maxWidth: "80%" }}
            >
              {item.media && (
                <MediaMessage
                  media={item.media}
                  onPress={() => handleMediaPreview(item.media!)}
                />
              )}
              <View
                className={`px-4 py-2.5 rounded-2xl ${
                  item.sender === "me" ? "bg-primary" : "bg-secondary"
                }`}
              >
                {item.text ? (
                  <Text className="text-foreground text-[15px]">
                    {renderMessageText(item.text, handleMentionPress)}
                  </Text>
                ) : null}
                <Text
                  className={`text-[11px] mt-1 ${
                    item.sender === "me"
                      ? "text-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.time}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Typing Indicator */}
        <TypingIndicator
          username={recipient?.username}
          visible={isRecipientTyping}
        />

        {showMentions && filteredUsers.length > 0 && (
          <View className="bg-card border-t border-border max-h-[200px]">
            <Text className="text-muted-foreground text-xs px-4 pt-3 pb-2">
              Mention a user
            </Text>
            {filteredUsers.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => handleMentionSelect(u.username)}
                className="flex-row items-center gap-3 px-4 py-2.5 bg-card"
              >
                <Image
                  source={{ uri: u.avatar }}
                  className="w-9 h-9 rounded-full"
                />
                <View>
                  <Text className="text-foreground font-medium">
                    {u.username}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {u.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View>
          {pendingMedia && (
            <View className="flex-row items-center bg-secondary p-2 mx-4 mt-2 rounded-xl gap-3">
              <Image
                source={{ uri: pendingMedia.uri }}
                className="w-12 h-12 rounded-lg"
                contentFit="cover"
              />
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-sm">
                  {pendingMedia.type === "video" ? "Video" : "Photo"}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  Ready to send
                </Text>
              </View>
              <Pressable
                onPress={() => setPendingMedia(null)}
                className="w-8 h-8 rounded-full bg-white/10 justify-center items-center"
              >
                <X size={18} color="#fff" />
              </Pressable>
            </View>
          )}

          <View className="flex-row items-center gap-2 border-t border-border px-3 py-3">
            <Pressable
              onPress={handlePickMedia}
              className="w-10 h-10 rounded-full bg-secondary justify-center items-center"
            >
              <ImageIcon size={22} color="#3EA4E5" />
            </Pressable>

            <TextInput
              ref={inputRef}
              value={currentMessage}
              onChangeText={handleTextChange}
              onSelectionChange={handleSelectionChange}
              placeholder="Message... (use @ to mention)"
              placeholderTextColor="#666"
              className="flex-1 min-h-[40px] max-h-[100px] bg-secondary rounded-full px-4 py-2.5 text-foreground"
              multiline
            />

            <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={`w-10 h-10 rounded-full justify-center items-center ${
                  canSend ? "bg-primary" : "bg-secondary"
                }`}
              >
                <Send size={20} color={canSend ? "#fff" : "#666"} />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <MediaPreviewModal
          visible={showPreviewModal}
          onClose={handleClosePreview}
          media={previewMedia}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
