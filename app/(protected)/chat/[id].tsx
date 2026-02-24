import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Platform,
  Modal,
  Alert,
  StyleSheet,
  Keyboard,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { LegendList } from "@/components/list";
import type { LegendListRef } from "@/components/list";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
  useNavigation,
} from "expo-router";
import { Image } from "expo-image";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Send,
  ImageIcon,
  X,
  Play,
  MessageCircle,
  Video,
  Phone,
  Camera,
  Trash2,
  Pencil,
  Copy,
} from "lucide-react-native";
import { EmptyState } from "@/components/ui/empty-state";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useChatStore,
  Message,
  MediaAttachment,
} from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { messagesApiClient } from "@/lib/api/messages";
import { MENTION_COLOR } from "@/src/constants/mentions";
import { useRefreshMessageCounts } from "@/lib/hooks/use-messages";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { ChatSkeleton } from "@/components/skeletons";
import { useUIStore } from "@/lib/stores/ui-store";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import * as ImagePicker from "expo-image-picker";
import { MediaPreviewModal } from "@/components/media-preview-modal";
import * as VideoThumbnails from "expo-video-thumbnails";
import { LinearGradient } from "expo-linear-gradient";
import { useTypingIndicator } from "@/lib/hooks/use-typing-indicator";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useUserPresence, formatLastSeen } from "@/lib/hooks/use-presence";
import { StoryReplyBubble } from "@/components/chat/story-reply-bubble";
import { SharedPostBubble } from "@/components/chat/shared-post-bubble";
import { Galeria } from "@nandorojo/galeria";
import { useCameraResultStore } from "@/lib/stores/camera-result-store";
import { SheetHeader } from "@/components/ui/sheet-header";

export const unstable_settings = {
  options: {
    cornerRadius: 16,
    grabber: true,
  },
};

// Empty array - messages will come from backend
const emptyMessages: Message[] = [];

// Chat bubble color palette
// 1-on-1: own = #3FDCFF (cyan), theirs = #8A40CF (purple)
// Group: first two "them" senders get cyan/purple, rest get complementary colors
const GROUP_BUBBLE_COLORS = [
  "#8A40CF", // purple
  "#3FDCFF", // cyan
  "#E84393", // magenta-pink
  "#00B894", // mint green
  "#FDCB6E", // warm gold
  "#6C5CE7", // indigo
];

function getGroupBubbleColor(
  senderId: string | undefined,
  senderColorMap: Map<string, string>,
): string {
  if (!senderId) return GROUP_BUBBLE_COLORS[0];
  if (senderColorMap.has(senderId)) return senderColorMap.get(senderId)!;
  const idx = senderColorMap.size % GROUP_BUBBLE_COLORS.length;
  const color = GROUP_BUBBLE_COLORS[idx];
  senderColorMap.set(senderId, color);
  return color;
}

// Returns true if the bubble bg is light enough to need dark text
function needsDarkText(hex: string): boolean {
  const light = ["#3FDCFF", "#FDCB6E", "#00B894"];
  return light.includes(hex);
}

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
          style={{ color: MENTION_COLOR, fontWeight: "600" }}
        >
          {part}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

interface MediaMessageProps {
  mediaList: MediaAttachment[];
  onPress: (media: MediaAttachment) => void;
}

function SingleVideoThumb({ media }: { media: MediaAttachment }) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(media.uri, { time: 500 })
      .then(({ uri }) => {
        if (!cancelled) setThumbUri(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media.uri]);

  return (
    <View style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }}>
      {thumbUri && (
        <Image
          source={{ uri: thumbUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      )}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        <LinearGradient
          colors={[
            "rgba(52,162,223,0.8)",
            "rgba(138,64,207,0.8)",
            "rgba(255,91,252,0.8)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Play size={20} color="#fff" fill="#fff" />
        </LinearGradient>
      </View>
    </View>
  );
}

function MediaMessage({ mediaList, onPress }: MediaMessageProps) {
  const imageUrls = mediaList
    .filter((m) => m.type === "image")
    .map((m) => m.uri);
  const total = mediaList.length;
  // Show max 4 tiles; if more, last tile gets a "+N" overlay
  const visible = mediaList.slice(0, 4);
  const overflow = total > 4 ? total - 4 : 0;
  const GRID = 220; // grid width in px
  const GAP = 3;
  const HALF = (GRID - GAP) / 2;

  const renderTile = (
    media: MediaAttachment,
    index: number,
    w: number,
    h: number,
    isLast: boolean,
  ) => {
    const inner =
      media.type === "video" ? (
        <Pressable
          key={media.uri}
          onPress={() => onPress(media)}
          style={{
            width: w,
            height: h,
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#222",
          }}
        >
          <SingleVideoThumb media={media} />
        </Pressable>
      ) : (
        <Galeria.Image
          key={media.uri}
          index={
            imageUrls.indexOf(media.uri) >= 0
              ? imageUrls.indexOf(media.uri)
              : index
          }
        >
          <Image
            source={{ uri: media.uri }}
            style={{
              width: w,
              height: h,
              borderRadius: 6,
              backgroundColor: "#222",
            }}
            contentFit="cover"
          />
        </Galeria.Image>
      );

    if (isLast && overflow > 0) {
      return (
        <View key={media.uri} style={{ position: "relative" }}>
          {inner}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 6,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
              +{overflow}
            </Text>
          </View>
        </View>
      );
    }
    return inner;
  };

  const content =
    total === 1 ? (
      renderTile(visible[0], 0, GRID, GRID, false)
    ) : total === 2 ? (
      <View style={{ flexDirection: "row", gap: GAP, width: GRID }}>
        {visible.map((m, i) => renderTile(m, i, HALF, GRID * 0.75, false))}
      </View>
    ) : total === 3 ? (
      <View style={{ flexDirection: "row", gap: GAP, width: GRID }}>
        {renderTile(visible[0], 0, HALF, GRID * 0.75, false)}
        <View style={{ gap: GAP }}>
          {renderTile(visible[1], 1, HALF, (GRID * 0.75 - GAP) / 2, false)}
          {renderTile(visible[2], 2, HALF, (GRID * 0.75 - GAP) / 2, false)}
        </View>
      </View>
    ) : (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: GAP,
          width: GRID,
        }}
      >
        {visible.map((m, i) =>
          renderTile(m, i, HALF, HALF, i === visible.length - 1),
        )}
      </View>
    );

  return (
    <Galeria urls={imageUrls.length > 0 ? imageUrls : undefined}>
      <View style={{ borderRadius: 10, overflow: "hidden" }}>{content}</View>
    </Galeria>
  );
}

function SwipeDeleteAction(
  _prog: SharedValue<number>,
  drag: SharedValue<number>,
) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + 80 }],
  }));

  return (
    <Reanimated.View style={[swipeStyles.deleteAction, animStyle]}>
      <Trash2 size={20} color="#fff" />
      <Text style={swipeStyles.deleteText}>Delete</Text>
    </Reanimated.View>
  );
}

const swipeStyles = StyleSheet.create({
  deleteAction: {
    width: 80,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginVertical: 2,
  },
  deleteText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});

function ChatPresenceText({ recipientId }: { recipientId?: string }) {
  const { isOnline, lastSeen } = useUserPresence(recipientId);
  const statusText = isOnline
    ? "Active now"
    : lastSeen
      ? formatLastSeen(lastSeen)
      : "";
  return (
    <Text
      style={{
        fontSize: 12,
        color: isOnline ? "#22C55E" : "#6B7280",
      }}
    >
      {statusText}
    </Text>
  );
}

export default function ChatScreen() {
  const { id, peerAvatar, peerUsername, peerName } = useLocalSearchParams<{
    id: string;
    peerAvatar?: string;
    peerUsername?: string;
    peerName?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const chatId = id || "1";

  // Track the active conversation ID used for reading/writing messages.
  // Starts as chatId (could be username like "woahmikey"), then gets updated
  // to the resolved numeric ID (e.g., "42") after username resolution.
  // This ensures messages[activeConvId] matches where loadMessages stores data.
  const [activeConvId, setActiveConvId] = useState(chatId);

  // Set TrueSheet header — use peerUsername from route params for instant render
  // Falls back to "Chat" if no params passed (e.g. deep link)
  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <SheetHeader
          title={peerUsername || "Chat"}
          onClose={() => router.back()}
        />
      ),
    });
  }, [navigation, router, peerUsername]);
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessageToBackend,
    loadMessages,
    mentionQuery,
    showMentions,
    setCursorPosition,
    insertMention,
    pendingMedia,
    setPendingMedia,
    isSending,
  } = useChatStore();

  const chatMessages = messages[activeConvId] || emptyMessages;

  // Hook to refresh message counts after marking as read
  const refreshMessageCounts = useRefreshMessageCounts();

  // Track the resolved conversation ID so useFocusEffect can use it
  // (chatId may be a username like "ibreathereal", not a numeric conv ID)
  const resolvedConvIdRef = useRef<string | null>(null);

  // Refresh messages on focus to pick up read receipts from the other user
  useFocusEffect(
    useCallback(() => {
      const convId = resolvedConvIdRef.current;
      if (convId && chatMessages.length > 0) {
        // Silently reload to pick up readAt changes — use RESOLVED conv ID
        loadMessages(convId);
      }
    }, [loadMessages, chatMessages.length > 0]),
  );

  // Load messages from backend on mount and mark as read
  useEffect(() => {
    if (chatId) {
      console.log("[Chat] Loading messages for conversation:", chatId);

      // Resolve conversation ID then load messages — NO waterfalls
      const loadChat = async () => {
        try {
          let actualConversationId = chatId;

          // If chatId looks like a username (alphanumeric, no hyphens) → resolve to conversation ID
          const looksLikeUsername =
            /^[a-zA-Z0-9_]+$/.test(chatId) &&
            !chatId.includes("-") &&
            !/^\d+$/.test(chatId);
          if (looksLikeUsername) {
            console.log("[Chat] chatId is username, resolving conversation...");
            const convId =
              await messagesApiClient.getOrCreateConversation(chatId);
            if (convId) actualConversationId = convId;
          }

          // Store resolved ID for useFocusEffect AND update activeConvId
          // so the screen reads from the same bucket that loadMessages writes to.
          resolvedConvIdRef.current = actualConversationId;
          setActiveConvId(actualConversationId);

          // Load messages FIRST — this is what the user sees
          await loadMessages(actualConversationId);

          // Mark as read + reload read receipts + refresh badge — all background, no blocking
          messagesApiClient.markAsRead(actualConversationId).then(async () => {
            await Promise.all([
              loadMessages(actualConversationId),
              refreshMessageCounts(),
            ]);
            console.log("[Chat] Read receipts + badge refreshed");
          });
        } catch (error) {
          console.error("[Chat] loadChat error:", error);
          await loadMessages(chatId);
        }
      };

      loadChat();
    }
  }, [chatId, loadMessages, refreshMessageCounts]);
  const currentUser = useAuthStore((s) => s.user);

  // Chat recipient info — seeded from route params for instant render,
  // then overwritten by full conversation data from backend
  const [recipient, setRecipient] = useState<{
    id: string;
    authId?: string;
    username: string;
    name: string;
    avatar: string;
  } | null>(
    peerUsername
      ? {
          id: "",
          username: peerUsername,
          name: peerName || peerUsername,
          avatar: peerAvatar || "",
        }
      : null,
  );
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(!peerUsername);
  const [isGroupChat, setIsGroupChat] = useState(false);

  // Build a stable color map for group chat senders (only "them" messages)
  const senderColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!isGroupChat) return map;
    for (const msg of chatMessages) {
      if (msg.sender === "them" && msg.senderId && !map.has(msg.senderId)) {
        const idx = map.size % GROUP_BUBBLE_COLORS.length;
        map.set(msg.senderId, GROUP_BUBBLE_COLORS[idx]);
      }
    }
    return map;
  }, [isGroupChat, chatMessages]);

  // Load recipient info via direct conversation lookup (no ghost filter, no heavy getConversations)
  // NEVER call getOrCreateConversation(chatId) — chatId is a conversation ID, not a user ID.
  useEffect(() => {
    const loadRecipientFromConversation = async () => {
      if (!chatId || !currentUser) {
        setIsLoadingRecipient(false);
        return;
      }

      try {
        console.log("[Chat] Loading conversation data for:", chatId);

        // Direct single-conversation query — works for new (empty) conversations too
        const conversation =
          await messagesApiClient.getConversationById(chatId);

        if (conversation) {
          setIsGroupChat(!!conversation.isGroup);
          const otherUser = conversation.user;

          if (otherUser) {
            console.log("[Chat] Found recipient:", otherUser.username);
            setRecipient({
              id: otherUser.id,
              authId: otherUser.authId || "",
              username: otherUser.username,
              name: otherUser.name || otherUser.username,
              avatar: otherUser.avatar || "",
            });
          } else {
            console.warn("[Chat] No user found in conversation");
          }
        } else {
          console.warn("[Chat] Conversation not found:", chatId);
        }
      } catch (error) {
        console.error("[Chat] Error loading conversation:", error);
      } finally {
        setIsLoadingRecipient(false);
      }
    };

    loadRecipientFromConversation();
  }, [chatId, currentUser]);

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
  const listRef = useRef<LegendListRef>(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const {
    previewMedia,
    showPreviewModal,
    setPreviewMedia,
    setShowPreviewModal,
  } = useFeedPostUIStore();
  const { loadingScreens, setScreenLoading } = useUIStore();
  const isLoading = loadingScreens.chat;

  useEffect(() => {
    setScreenLoading("chat", false);
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

  const queryClient = useQueryClient();

  const handleSend = useCallback(() => {
    // Read fresh state from store — avoids stale closure bugs
    const store = useChatStore.getState();
    if (!store.currentMessage.trim() && store.pendingMedia.length === 0) return;
    if (store.isSending) return;

    const messageText = store.currentMessage.trim();

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

    Keyboard.dismiss();
    // Use the resolved numeric conversation ID — chatId may be a username string
    // which parseInt() turns into NaN, causing the edge function to reject the send.
    const convId = resolvedConvIdRef.current || chatId;

    // GUARD: If conv ID hasn't resolved yet and chatId is a username, block send.
    // Without this, sendMessage would pass a username to the edge function,
    // parseInt() → NaN, and the message silently fails.
    if (!resolvedConvIdRef.current && !/^\d+$/.test(chatId)) {
      console.warn("[Chat] Send blocked — conversation ID not resolved yet");
      return;
    }

    // OPTIMISTIC: patch conversations list cache so lastMessage updates instantly
    // without waiting for a full refetch of the conversations list.
    if (messageText) {
      const nowStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      queryClient.setQueriesData<any[]>(
        { queryKey: ["messages", "filtered"] },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((conv: any) =>
            String(conv.id) === String(convId)
              ? {
                  ...conv,
                  lastMessage: messageText,
                  timestamp: "Just now",
                  unread: false,
                }
              : conv,
          );
        },
      );
    }

    sendMessageToBackend(convId);
  }, [
    chatId,
    sendMessageToBackend,
    sendButtonScale,
    queryClient,
    activeConvId,
  ]);

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

  const consumeCameraResult = useCameraResultStore((s) => s.consumeResult);

  // Consume camera result when returning from camera screen
  // Guard: don't overwrite pendingMedia if currently sending
  useFocusEffect(
    useCallback(() => {
      if (useChatStore.getState().isSending) return;
      const result = consumeCameraResult();
      if (result) {
        const media: MediaAttachment = {
          type: result.type,
          uri: result.uri,
          width: result.width,
          height: result.height,
          duration: result.duration,
        };
        setPendingMedia([media]);
      }
    }, [consumeCameraResult, setPendingMedia]),
  );

  const handleOpenCamera = useCallback(() => {
    router.push({
      pathname: "/(protected)/camera",
      params: { mode: "both", source: "chat", maxDuration: "60" },
    });
  }, [router]);

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets.length > 0) {
      const mediaList: MediaAttachment[] = [];
      let hasVideo = false;
      for (const asset of result.assets) {
        const isVideo = asset.type === "video";
        if (isVideo && asset.duration && asset.duration > 60000) {
          showToast(
            "error",
            "Video too long",
            "Please select a video under 60 seconds.",
          );
          continue;
        }
        if (isVideo && hasVideo) {
          // Only one video per message
          continue;
        }
        if (isVideo) hasVideo = true;
        mediaList.push({
          type: isVideo ? "video" : "image",
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          duration: asset.duration ?? undefined,
        });
      }
      // If a video is included, only send that video (no mixing)
      if (hasVideo) {
        const video = mediaList.find((m) => m.type === "video");
        if (video) {
          setPendingMedia([video]);
          if (mediaList.length > 1) {
            showToast(
              "info",
              "One video at a time",
              "Videos are sent individually.",
            );
          }
          return;
        }
      }
      if (mediaList.length > 0) {
        setPendingMedia(mediaList);
      }
    }
  }, [setPendingMedia, showToast]);

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

  const canSend =
    (currentMessage.trim() || pendingMedia.length > 0) && !isSending;

  // Message action sheet state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");

  const { deleteMessage, editMessage, reactToMessage } = useChatStore();

  // Reaction emojis (Instagram-style)
  const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

  // Double-tap tracking
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const handleLongPressMessage = useCallback((message: Message) => {
    setSelectedMessage(message);
    setShowMessageActions(true);
  }, []);

  const handleDoubleTap = useCallback(
    (message: Message) => {
      const now = Date.now();
      const last = lastTapRef.current;
      if (last.id === message.id && now - last.time < 300) {
        // Double tap detected — heart react
        reactToMessage(chatId, message.id, "❤️");
        lastTapRef.current = { id: "", time: 0 };
      } else {
        lastTapRef.current = { id: message.id, time: now };
      }
    },
    [chatId, reactToMessage],
  );

  const handleReaction = useCallback(
    (emoji: string) => {
      if (!selectedMessage) return;
      reactToMessage(chatId, selectedMessage.id, emoji);
      setShowMessageActions(false);
      setSelectedMessage(null);
    },
    [selectedMessage, chatId, reactToMessage],
  );

  const handleUnsendMessage = useCallback(() => {
    if (!selectedMessage) return;
    setShowMessageActions(false);

    Alert.alert(
      "Unsend Message",
      "This message will be removed for everyone in the chat.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsend",
          style: "destructive",
          onPress: () => {
            deleteMessage(chatId, selectedMessage.id);
            showToast("success", "Unsent", "Message removed");
            setSelectedMessage(null);
          },
        },
      ],
    );
  }, [selectedMessage, chatId, deleteMessage, showToast]);

  const handleStartEdit = useCallback(() => {
    if (!selectedMessage) return;
    setShowMessageActions(false);
    setEditingMessage(selectedMessage);
    setEditText(selectedMessage.text);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleSaveEdit = useCallback(() => {
    if (!editingMessage || !editText.trim()) return;
    editMessage(chatId, editingMessage.id, editText.trim());
    showToast("success", "Edited", "Message updated");
    setEditingMessage(null);
    setEditText("");
  }, [editingMessage, editText, chatId, editMessage, showToast]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditText("");
  }, []);

  const handleCopyMessage = useCallback(() => {
    if (!selectedMessage?.text) return;
    // Copy not available without expo-clipboard — show toast only
    showToast("info", "Copy", selectedMessage.text.slice(0, 100));
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, showToast]);

  // Show loading while loading screen state OR loading recipient
  if (isLoading || isLoadingRecipient) {
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
      keyboardVerticalOffset={0}
    >
      <SafeAreaView
        edges={["top"]}
        className="flex-1 bg-background max-w-3xl w-full self-center"
      >
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
              <ChatPresenceText recipientId={recipient?.id} />
            </View>
          </Pressable>
          {/* Audio Call Button */}
          <Pressable
            onPress={() => {
              // CRITICAL: participantIds MUST use integer PK (recipient.id), NOT authId.
              // The callee's realtime subscription filters on user.id which is the integer PK.
              // Using authId causes callee_id mismatch and callee never receives the call.
              if (recipient?.id) {
                router.push({
                  pathname: "/(protected)/call/[roomId]",
                  params: {
                    roomId: `call-${Date.now()}`,
                    isOutgoing: "true",
                    participantIds: recipient.id,
                    callType: "audio",
                    chatId: chatId,
                    recipientUsername: recipient.username,
                    recipientAvatar: recipient.avatar || "",
                  },
                });
              }
            }}
            className="p-2 rounded-full bg-primary/20"
            hitSlop={12}
          >
            <Phone size={22} color="#3EA4E5" />
          </Pressable>
          {/* Video Call Button */}
          <Pressable
            onPress={() => {
              // CRITICAL: participantIds MUST use integer PK (recipient.id), NOT authId.
              // See audio call button comment above for explanation.
              if (recipient?.id) {
                router.push({
                  pathname: "/(protected)/call/[roomId]",
                  params: {
                    roomId: `call-${Date.now()}`,
                    isOutgoing: "true",
                    participantIds: recipient.id,
                    callType: "video",
                    chatId: chatId,
                    recipientUsername: recipient.username,
                    recipientAvatar: recipient.avatar || "",
                  },
                });
              }
            }}
            className="p-2 rounded-full bg-primary/20"
            hitSlop={12}
          >
            <Video size={22} color="#3EA4E5" />
          </Pressable>
        </View>

        <LegendList
          ref={listRef}
          data={chatMessages}
          extraData={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          initialScrollAtEnd
          maintainScrollAtEnd
          alignItemsAtEnd
          renderItem={({ item }) => {
            const isMe = item.sender === "me";
            const hasReactions = item.reactions && item.reactions.length > 0;
            // Show read receipt only on the last read message sent by me
            const isLastReadByMe =
              isMe &&
              item.readAt &&
              (() => {
                // Find the last "me" message with readAt in the list
                for (let i = chatMessages.length - 1; i >= 0; i--) {
                  const m = chatMessages[i];
                  if (m.sender === "me" && m.readAt) return m.id === item.id;
                }
                return false;
              })();

            // Group reactions by emoji for display
            const groupedReactions = (item.reactions || []).reduce(
              (acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            );

            const bubble = (() => {
              if (item.sharedPost) {
                return (
                  <View style={{ flexShrink: 1 }}>
                    <View className="mb-1">
                      <SharedPostBubble
                        sharedPost={item.sharedPost}
                        isOwnMessage={isMe}
                      />
                      <Text
                        className={`text-[11px] mt-1 px-1 ${
                          isMe ? "text-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {item.time}
                      </Text>
                    </View>
                  </View>
                );
              }
              if (item.storyReply) {
                return (
                  <View style={{ flexShrink: 1 }}>
                    <View className="mb-1">
                      <StoryReplyBubble
                        storyReply={item.storyReply}
                        replyText={item.text}
                        isOwnMessage={isMe}
                      />
                      <Text
                        className={`text-[11px] mt-1 px-1 ${
                          isMe ? "text-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {item.time}
                      </Text>
                    </View>
                  </View>
                );
              }

              const hasMedia = item.media && item.media.length > 0;
              const bubbleBg = isMe
                ? "#3FDCFF"
                : isGroupChat
                  ? getGroupBubbleColor(item.senderId, senderColorMap)
                  : "#8A40CF";
              const darkText = needsDarkText(bubbleBg);

              return (
                <View style={{ flexShrink: 1 }}>
                  <View
                    style={{
                      borderRadius: 16,
                      backgroundColor: bubbleBg,
                      flexShrink: 1,
                      maxWidth: "100%",
                      overflow: "hidden",
                    }}
                  >
                    {hasMedia && (
                      <View style={{ padding: 4 }}>
                        <MediaMessage
                          mediaList={item.media!}
                          onPress={(m) => handleMediaPreview(m)}
                        />
                      </View>
                    )}
                    <Pressable
                      onPress={() => handleDoubleTap(item)}
                      onLongPress={() => handleLongPressMessage(item)}
                      delayLongPress={400}
                      style={{
                        paddingHorizontal: 14,
                        paddingTop: hasMedia ? 6 : 10,
                        paddingBottom: 10,
                      }}
                    >
                      {item.text ? (
                        <Text
                          style={{
                            fontSize: 15,
                            color: darkText ? "#000" : "#fff",
                          }}
                        >
                          {renderMessageText(item.text, handleMentionPress)}
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          color: darkText
                            ? "rgba(0,0,0,0.5)"
                            : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {item.time}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })();

            const reactionPills = hasReactions ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 4,
                  marginTop: 2,
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  marginLeft: isMe ? 0 : 40,
                }}
              >
                {Object.entries(groupedReactions).map(([emoji, count]) => (
                  <Pressable
                    key={emoji}
                    onPress={() => reactToMessage(chatId, item.id, emoji)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderWidth: 1,
                      borderColor: (item.reactions || []).some(
                        (r) =>
                          r.emoji === emoji && r.userId === currentUser?.id,
                      )
                        ? "#3EA4E5"
                        : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{emoji}</Text>
                    {(count as number) > 1 && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#999",
                          marginLeft: 2,
                        }}
                      >
                        {count}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null;

            const messageContent = isMe ? (
              <View
                className="flex-row items-end gap-2 mb-2 self-end"
                style={{ maxWidth: "80%" }}
              >
                <View style={{ flexShrink: 1 }}>
                  {bubble}
                  {reactionPills}
                  {isLastReadByMe && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.45)",
                        textAlign: "right",
                        marginTop: 2,
                        paddingRight: 4,
                      }}
                    >
                      Read{" "}
                      {(() => {
                        try {
                          const d = new Date(item.readAt!);
                          return isNaN(d.getTime())
                            ? ""
                            : `· ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                        } catch {
                          return "";
                        }
                      })()}
                    </Text>
                  )}
                </View>
                <Avatar
                  uri={currentUser?.avatar || ""}
                  username={currentUser?.username || currentUser?.name || ""}
                  size={28}
                  variant="roundedSquare"
                />
              </View>
            ) : (
              <View className="flex-row items-end gap-2 mb-2 self-start">
                <Avatar
                  uri={recipient?.avatar || ""}
                  username={recipient?.username || ""}
                  size={28}
                  variant="roundedSquare"
                />
                <View style={{ flexShrink: 1, maxWidth: "80%" }}>
                  {bubble}
                  {reactionPills}
                </View>
              </View>
            );

            // Only own messages can be swiped to delete
            if (isMe) {
              return (
                <ReanimatedSwipeable
                  friction={2}
                  rightThreshold={40}
                  renderRightActions={SwipeDeleteAction}
                  onSwipeableOpen={(direction) => {
                    if (direction === "right") {
                      Alert.alert(
                        "Unsend Message",
                        "This message will be removed for everyone.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Unsend",
                            style: "destructive",
                            onPress: () => {
                              deleteMessage(chatId, item.id);
                              showToast("success", "Unsent", "Message removed");
                            },
                          },
                        ],
                      );
                    }
                  }}
                  overshootRight={false}
                >
                  {messageContent}
                </ReanimatedSwipeable>
              );
            }

            return messageContent;
          }}
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
          {pendingMedia.length > 0 && (
            <View className="flex-row items-center bg-secondary p-2 mx-4 mt-2 rounded-xl gap-3">
              <View style={{ flexDirection: "row", gap: 4 }}>
                {pendingMedia.slice(0, 4).map((m, i) => (
                  <Image
                    key={i}
                    source={{ uri: m.uri }}
                    style={{ width: 48, height: 48, borderRadius: 8 }}
                    contentFit="cover"
                  />
                ))}
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-sm">
                  {pendingMedia.length === 1
                    ? pendingMedia[0].type === "video"
                      ? "Video"
                      : "Photo"
                    : `${pendingMedia.length} items`}
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
              onPress={handleOpenCamera}
              className="w-10 h-10 rounded-full bg-secondary justify-center items-center"
            >
              <Camera size={22} color="#3EA4E5" />
            </Pressable>
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

        {/* Edit Message Bar */}
        {editingMessage && (
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderTopWidth: 1,
              borderTopColor: "#333",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Pencil size={16} color="#3EA4E5" />
                <Text
                  style={{ color: "#3EA4E5", fontSize: 13, fontWeight: "600" }}
                >
                  Editing message
                </Text>
              </View>
              <Pressable onPress={handleCancelEdit} hitSlop={12}>
                <X size={18} color="#999" />
              </Pressable>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <TextInput
                value={editText}
                onChangeText={setEditText}
                style={{
                  flex: 1,
                  backgroundColor: "#262626",
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  color: "#fff",
                  fontSize: 15,
                }}
                autoFocus
                multiline
                maxLength={500}
              />
              <Pressable
                onPress={handleSaveEdit}
                disabled={!editText.trim()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: editText.trim() ? "#3EA4E5" : "#333",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={18} color={editText.trim() ? "#fff" : "#666"} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Message Action Sheet */}
        <Modal
          visible={showMessageActions}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowMessageActions(false);
            setSelectedMessage(null);
          }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => {
              setShowMessageActions(false);
              setSelectedMessage(null);
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: "#1a1a1a",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingBottom: 40,
                }}
              >
                {/* Handle */}
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: "#555",
                    }}
                  />
                </View>

                {/* Emoji Reaction Bar */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-evenly",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "#333",
                  }}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => handleReaction(emoji)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: selectedMessage?.reactions?.some(
                          (r) =>
                            r.emoji === emoji && r.userId === currentUser?.id,
                        )
                          ? "rgba(62,164,229,0.2)"
                          : "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Message preview */}
                {selectedMessage && (
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#333",
                    }}
                  >
                    <Text
                      style={{ color: "#999", fontSize: 13 }}
                      numberOfLines={2}
                    >
                      {selectedMessage.text || "(media)"}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={{ paddingTop: 4 }}>
                  {/* Copy — available for all messages */}
                  {selectedMessage?.text ? (
                    <Pressable
                      onPress={handleCopyMessage}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                      }}
                    >
                      <Copy size={22} color="#fff" />
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#fff",
                          marginLeft: 16,
                        }}
                      >
                        Copy
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Edit — only for own messages with text */}
                  {selectedMessage?.sender === "me" && selectedMessage?.text ? (
                    <Pressable
                      onPress={handleStartEdit}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                      }}
                    >
                      <Pencil size={22} color="#fff" />
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#fff",
                          marginLeft: 16,
                        }}
                      >
                        Edit
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Unsend — only for own messages */}
                  {selectedMessage?.sender === "me" ? (
                    <Pressable
                      onPress={handleUnsendMessage}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                      }}
                    >
                      <Trash2 size={22} color="#ef4444" />
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#ef4444",
                          marginLeft: 16,
                        }}
                      >
                        Unsend
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
