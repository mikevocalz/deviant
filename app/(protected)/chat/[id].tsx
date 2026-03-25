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
  InteractionManager,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { LegendList } from "@/components/list";
import type { LegendListRef } from "@/components/list";
import {
  KeyboardAvoidingView,
  KeyboardController,
  KeyboardGestureArea,
} from "react-native-keyboard-controller";
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
import { useUIStore } from "@/lib/stores/ui-store";
import { useChatScreenStore } from "@/lib/stores/chat-screen-store";
import { normalizeChatParams } from "@/lib/navigation/chat-routes";
import { messagesApiClient } from "@/lib/api/messages";
import { useConversationResolution } from "@/lib/hooks/use-conversation-resolution";
import { MENTION_COLOR } from "@/src/constants/mentions";
import { useRefreshMessageCounts } from "@/lib/hooks/use-messages";
import { useQueryClient } from "@tanstack/react-query";
import { screenPrefetch } from "@/lib/prefetch";
import {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { ChatSkeleton } from "@/components/skeletons";
import { ErrorBoundary } from "@/components/error-boundary";
// import { normalizeArray } from "@/lib/normalization/safe-entity"; // Temporarily disabled
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import * as ImagePicker from "expo-image-picker";
import { MediaPreviewModal } from "@/components/media-preview-modal";
// expo-video-thumbnails removed — hangs on iOS 26.3
import { LinearGradient } from "expo-linear-gradient";
import { useTypingIndicator } from "@/lib/hooks/use-typing-indicator";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useUserPresence, formatLastSeen } from "@/lib/hooks/use-presence";
import { StoryReplyBubble } from "@/components/chat/story-reply-bubble";
import { SharedPostBubble } from "@/components/chat/shared-post-bubble";
import { Galeria } from "@nandorojo/galeria";
import { useCameraResultStore } from "@/lib/stores/camera-result-store";
import { SheetHeader } from "@/components/ui/sheet-header";
import { supabase } from "@/lib/supabase/client";

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
  // expo-video-thumbnails disabled — hangs on iOS 26.3
  // Use expo-image with the video URI (renders first frame for local files)
  // or just show play button for remote CDN URLs
  return (
    <View style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }}>
      <Image
        source={{ uri: media.uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
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
  const safeMediaList = mediaList || [];
  const imageUrls = safeMediaList
    .filter((m) => m.type === "image")
    .map((m) => m.uri);
  const total = safeMediaList.length;
  // Show max 4 tiles; if more, last tile gets a "+N" overlay
  const visible = safeMediaList.slice(0, 4);
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

function ChatScreenContent() {
  const rawParams = useLocalSearchParams<{
    id: string;
    peerAvatar?: string;
    peerUsername?: string;
    peerName?: string;
  }>();

  // CRITICAL: Normalize params ONCE at mount to stable primitives
  // Prevents infinite loops from string|string[] type instability
  const { chatId, peerAvatar, peerUsername, peerName } = useMemo(
    () => normalizeChatParams(rawParams),
    [
      rawParams.id,
      rawParams.peerAvatar,
      rawParams.peerUsername,
      rawParams.peerName,
    ],
  );

  const router = useRouter();
  const navigation = useNavigation();

  // PRODUCTION FIX: Use TanStack Query for conversation resolution with caching.
  // This prevents duplicate edge function calls and eliminates the waterfall pattern.
  // The query returns instantly from cache if we've already resolved this identifier.
  const {
    data: resolvedConvId,
    isLoading: isResolvingConversation,
    error: resolutionError,
    refetch: retryResolution,
  } = useConversationResolution(chatId);

  // Track the active conversation ID used for reading/writing messages.
  // CRITICAL: For numeric IDs, use chatId directly even if resolution failed
  // This allows existing conversations to work even if edge function is down
  const isNumericId = /^\d+$/.test(chatId);
  const activeConvId = resolvedConvId || (isNumericId ? chatId : "");

  // Set TrueSheet header — use peerUsername from route params for instant render
  // Falls back to "Chat" if no params passed (e.g. deep link)
  // STABLE: peerUsername is now a primitive string from normalizeChatParams
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
    retryMessage,
  } = useChatStore();

  const chatMessages = messages[activeConvId] || emptyMessages;

  // Hook to refresh message counts after marking as read
  const refreshMessageCounts = useRefreshMessageCounts();

  // CRITICAL: Declare queryClient early so it can be passed to async functions
  // This prevents illegal hook calls inside async/nested functions
  const queryClient = useQueryClient();

  // Track the resolved conversation ID so useFocusEffect can use it
  // (chatId may be a username like "ibreathereal", not a numeric conv ID)
  const resolvedConvIdRef = useRef<string | null>(null);
  const conversationActionId = activeConvId || resolvedConvIdRef.current || "";

  // CRITICAL FIX: Track if initial load is complete to prevent infinite loop
  const hasLoadedInitialMessagesRef = useRef(false);

  // CRITICAL FIX #2: Track conversation validation state
  // Prevents markAsRead from firing before recipient load completes
  const [isConversationValid, setIsConversationValid] = useState(false);

  // Refresh messages on focus to pick up read receipts from the other user
  // FIX: Removed unstable chatMessages.length dependency that caused infinite loop
  useFocusEffect(
    useCallback(() => {
      const convId = resolvedConvIdRef.current;
      // Only reload if we've already loaded messages once (not on mount)
      if (convId && hasLoadedInitialMessagesRef.current) {
        console.log("[Chat] Focus refresh - reloading read receipts");
        loadMessages(convId);
      }
    }, [loadMessages]),
  );

  // SAFETY: Reset isSending on mount — prevents stuck state from prior chat sessions
  useEffect(() => {
    useChatStore.setState({ isSending: false });
  }, [chatId]);

  // Load messages once conversation ID is resolved
  // FIX: Added guard to prevent duplicate loads and infinite loops
  useEffect(() => {
    if (!activeConvId || isResolvingConversation) return;

    // GUARD: Prevent duplicate initial load
    if (
      hasLoadedInitialMessagesRef.current &&
      resolvedConvIdRef.current === activeConvId
    ) {
      console.log("[Chat] Skipping duplicate load for:", activeConvId);
      return;
    }

    console.log("[Chat] Loading messages for conversation:", activeConvId);

    // Store resolved ID for useFocusEffect
    resolvedConvIdRef.current = activeConvId;
    hasLoadedInitialMessagesRef.current = true;

    // Load messages FIRST — this is what the user sees
    loadMessages(activeConvId);

    // CRITICAL FIX: Only mark as read if conversation is validated
    // This prevents "Not a participant" errors for new conversations
    if (isConversationValid) {
      messagesApiClient
        .markAsRead(activeConvId)
        .then(async () => {
          await refreshMessageCounts();
          console.log("[Chat] Marked as read + badge refreshed");
        })
        .catch((error) => {
          console.error("[Chat] markAsRead error:", error);
        });
    } else {
      console.log(
        "[Chat] Skipping markAsRead - conversation not validated yet",
      );
    }
  }, [
    activeConvId,
    isResolvingConversation,
    isConversationValid,
    loadMessages,
    refreshMessageCounts,
  ]);

  // Realtime subscription — listen for new incoming messages so the chat
  // updates live without needing to close and reopen the screen.
  // FIX: Stabilized dependencies and added throttle guard
  useEffect(() => {
    const convId = resolvedConvIdRef.current;
    if (!convId || !/^\d+$/.test(convId)) return;

    // GUARD: Only subscribe after initial load completes
    if (!hasLoadedInitialMessagesRef.current) return;

    // Cancellation guard: prevents stale callbacks from executing after cleanup
    let cancelled = false;
    const userId = useAuthStore.getState().user?.id;

    // Throttle guard: prevent rapid-fire reloads
    let lastReloadTime = 0;
    const RELOAD_THROTTLE_MS = 1000;

    // Unique channel ID prevents collisions on rapid navigation
    const channelId = `chat-${convId}-${Date.now()}`;
    console.log("[Chat] Subscribing to realtime messages:", channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          if (cancelled) {
            console.log("[Chat] Ignoring message - subscription cancelled");
            return;
          }
          const newMsg = payload.new as any;
          // Skip own messages — already handled by optimistic update
          if (String(newMsg.sender_id) === String(userId)) return;

          // Throttle: prevent rapid reloads that can cause loops
          const now = Date.now();
          if (now - lastReloadTime < RELOAD_THROTTLE_MS) {
            console.log("[Chat] Throttling realtime reload");
            return;
          }
          lastReloadTime = now;

          // Refresh messages to pick up the new incoming message
          loadMessages(convId);
          // Auto-mark as read since the user is actively viewing the chat
          messagesApiClient.markAsRead(convId).catch(() => {});
        },
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        console.log("[Chat] Realtime subscription status:", status);
        if (err) {
          console.error("[Chat] Subscription error:", err);
        }
      });

    return () => {
      console.log("[Chat] Unsubscribing from:", channelId);
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeConvId, loadMessages]);
  // FIX: Replaced ALL useState with Zustand to comply with project mandate
  // and eliminate render loop triggers from state updates
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const {
    recipient,
    isLoadingRecipient,
    isGroupChat,
    groupMembers,
    groupName,
    selectedMessage,
    showMessageActions,
    editingMessage,
    editText,
    setRecipient,
    setIsLoadingRecipient,
    setGroupInfo,
    setSelectedMessage,
    setShowMessageActions,
    setEditingMessage,
    setEditText,
    resetChatScreen,
  } = useChatScreenStore();

  const safeGroupMembers = useMemo(() => groupMembers || [], [groupMembers]);

  // Initialize recipient from route params on mount (instant render)
  useEffect(() => {
    if (peerUsername && !recipient) {
      setRecipient({
        id: "",
        username: peerUsername,
        name: peerName || peerUsername,
        avatar: peerAvatar || "",
      });
      setIsLoadingRecipient(false);
    } else if (!peerUsername) {
      setIsLoadingRecipient(true);
    }
  }, []); // Only on mount

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
  // FIX: Stabilized dependencies - use primitive currentUserId instead of object currentUser
  const loadedRecipientConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadRecipientFromConversation = async (
      queryClient: ReturnType<typeof useQueryClient>,
    ) => {
      if (!activeConvId || !currentUserId) {
        setIsLoadingRecipient(false);
        return;
      }

      try {
        console.log("[Chat] Loading conversation data for:", activeConvId);
        loadedRecipientConversationIdRef.current = activeConvId;

        // Direct single-conversation query — works for new (empty) conversations too
        const conversation =
          await messagesApiClient.getConversationById(activeConvId);

        if (conversation) {
          if (conversation.isGroup && conversation.members) {
            setGroupInfo(
              true,
              conversation.members,
              conversation.groupName || "",
            );
            console.log(
              "[Chat] Group with",
              conversation.members.length,
              "other members",
            );
          }
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
            // Mark conversation as validated - safe to call markAsRead now
            setIsConversationValid(true);
          } else {
            console.warn("[Chat] No user found in conversation");
            setIsConversationValid(false);
          }
        } else {
          console.warn("[Chat] Conversation not found:", activeConvId);
          loadedRecipientConversationIdRef.current = null;
          setIsConversationValid(false);
          // CRITICAL: Orphaned conversation - invalidate cache and navigate back
          // This ensures retry will call edge function to create NEW conversation
          const { invalidateConversationCache } =
            await import("@/lib/hooks/use-conversation-resolution");
          invalidateConversationCache(queryClient, chatId);
          console.log(
            "[Chat] Invalidated cache for orphaned conversation:",
            activeConvId,
          );

          useUIStore
            .getState()
            .showToast(
              "error",
              "Conversation Error",
              "This conversation could not be loaded. Please try again.",
            );
          setIsLoadingRecipient(false);
          router.back();
          return;
        }
      } catch (error) {
        console.error("[Chat] Error loading conversation:", error);
        loadedRecipientConversationIdRef.current = null;
        setIsConversationValid(false);
        // Also invalidate cache on error
        const { invalidateConversationCache } =
          await import("@/lib/hooks/use-conversation-resolution");
        invalidateConversationCache(queryClient, chatId);

        useUIStore
          .getState()
          .showToast("error", "Error", "Failed to load conversation");
        setIsLoadingRecipient(false);
        router.back();
        return;
      } finally {
        setIsLoadingRecipient(false);
      }
    };

    if (!activeConvId) return;
    if (loadedRecipientConversationIdRef.current === activeConvId) return;

    loadRecipientFromConversation(queryClient);
  }, [
    activeConvId,
    chatId,
    currentUserId,
    setRecipient,
    setIsLoadingRecipient,
    setGroupInfo,
    queryClient,
  ]);

  // Get toast function
  const showToast = useUIStore((s) => s.showToast);

  // Prevent self-messaging
  // FIX: Use primitive IDs instead of objects, add ref guard to prevent loop
  const selfMessageCheckDoneRef = useRef(false);

  useEffect(() => {
    if (selfMessageCheckDoneRef.current) return;
    if (currentUserId && recipient?.id && currentUserId === recipient.id) {
      selfMessageCheckDoneRef.current = true;
      showToast("error", "Error", "You cannot message yourself");
      router.back();
    }
  }, [currentUserId, recipient?.id, router, showToast]);

  // Typing indicator
  const { typingUsers, handleInputChange: handleTypingChange } =
    useTypingIndicator({ conversationId: activeConvId });

  // Cleanup: Reset chat screen state when unmounting
  useEffect(() => {
    return () => {
      console.log("[Chat] Unmounting, resetting screen state");
      resetChatScreen();
      hasLoadedInitialMessagesRef.current = false;
      loadedRecipientConversationIdRef.current = null;
      selfMessageCheckDoneRef.current = false;
    };
  }, [resetChatScreen]);

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

    // PERF: Defer keyboard dismiss — calling it synchronously before send
    // triggers a layout recalculation that blocks the JS thread on iOS.
    InteractionManager.runAfterInteractions(() => KeyboardController.dismiss());
    // Use the resolved conversation ID from TanStack Query
    const convId = activeConvId;

    // GUARD: Block send ONLY if we have no conversation ID at all
    // Allow send to proceed even if resolution is slow/retrying
    if (!convId) {
      console.warn("[Chat] Send blocked — no conversation ID available");
      useUIStore
        .getState()
        .showToast(
          "error",
          "Can't send yet",
          "Still setting up chat. Try again in a moment.",
        );
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

    // CRITICAL: Clear the native TextInput buffer immediately.
    // Without this, the deferred KeyboardController.dismiss() triggers the native input
    // to commit its stale buffer → fires onChangeText with old text → overwrites
    // the store's cleared currentMessage. Clearing natively prevents the race.
    inputRef.current?.clear();
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
      screenPrefetch.profile(queryClient, username);
      router.push(`/(protected)/profile/${username}`);
    },
    [router, queryClient],
  );

  const handleProfilePress = useCallback(() => {
    if (recipient) {
      screenPrefetch.profile(queryClient, recipient.username);
      router.push(`/(protected)/profile/${recipient.username}`);
    }
  }, [router, recipient, queryClient]);

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

  // CRITICAL: Allow send if we have an active conversation ID
  // Don't block on isResolvingConversation - it might be retrying/slow
  // Block only if we truly have no conversation ID to send to
  const canSend =
    (currentMessage.trim() || pendingMedia.length > 0) &&
    !isSending &&
    !!activeConvId;

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
        if (!conversationActionId) return;
        reactToMessage(conversationActionId, message.id, "❤️");
        lastTapRef.current = { id: "", time: 0 };
      } else {
        lastTapRef.current = { id: message.id, time: now };
      }
    },
    [conversationActionId, reactToMessage],
  );

  const handleReaction = useCallback(
    (emoji: string) => {
      if (!selectedMessage || !conversationActionId) return;
      reactToMessage(conversationActionId, selectedMessage.id, emoji);
      setShowMessageActions(false);
      setSelectedMessage(null);
    },
    [selectedMessage, conversationActionId, reactToMessage],
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
            if (!conversationActionId) return;
            deleteMessage(conversationActionId, selectedMessage.id);
            showToast("success", "Unsent", "Message removed");
            setSelectedMessage(null);
          },
        },
      ],
    );
  }, [selectedMessage, conversationActionId, deleteMessage, showToast]);

  const handleStartEdit = useCallback(() => {
    if (!selectedMessage) return;
    setShowMessageActions(false);
    setEditingMessage(selectedMessage);
    setEditText(selectedMessage.text);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleSaveEdit = useCallback(() => {
    if (!editingMessage || !editText.trim() || !conversationActionId) return;
    editMessage(conversationActionId, editingMessage.id, editText.trim());
    showToast("success", "Edited", "Message updated");
    setEditingMessage(null);
    setEditText("");
  }, [editingMessage, editText, conversationActionId, editMessage, showToast]);

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

  // Show loading ONLY if truly loading, not if we have an error
  if ((isLoading || isLoadingRecipient) && !resolutionError) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ChatSkeleton />
      </SafeAreaView>
    );
  }

  // Show error UI if conversation resolution failed (Instagram-like retry)
  if (resolutionError && !activeConvId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Chat</Text>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <MessageCircle size={64} color="#666" strokeWidth={1.5} />
          <Text className="text-foreground text-lg font-semibold mt-4 text-center">
            Couldn't load chat
          </Text>
          <Text className="text-muted-foreground text-sm mt-2 text-center">
            Check your connection and try again
          </Text>
          <View className="flex-row gap-3 mt-6">
            <Pressable
              onPress={() => router.back()}
              className="px-6 py-3 bg-secondary rounded-xl"
            >
              <Text className="text-foreground font-semibold">Go Back</Text>
            </Pressable>
            <Pressable
              onPress={() => retryResolution()}
              className="px-6 py-3 bg-primary rounded-xl"
            >
              <Text className="text-primary-foreground font-semibold">
                Try Again
              </Text>
            </Pressable>
          </View>
        </View>
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

          {isGroupChat ? (
            /* ── Group chat header ── */
            <>
              <View className="flex-row items-center gap-3 flex-1">
                {/* Stacked avatars — rounded squares */}
                <View style={{ width: 44, height: 40 }}>
                  {safeGroupMembers.slice(0, 3).map((m, i) => (
                    <Image
                      key={m.id || i}
                      source={{ uri: m.avatar || "" }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: "#000",
                        position: "absolute",
                        left: i * 8,
                        top: i === 1 ? 10 : i === 2 ? 4 : 0,
                        zIndex: 3 - i,
                      }}
                    />
                  ))}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-base font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {groupName ||
                      safeGroupMembers.map((m) => m.username).join(", ") ||
                      "Group"}
                  </Text>
                  <Text
                    className="text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {safeGroupMembers.length + 1} members
                    {safeGroupMembers.length > 0 && " · "}
                    {safeGroupMembers
                      .map((m) => m.name || m.username)
                      .join(", ")}
                  </Text>
                </View>
              </View>
              {/* Group Audio Call */}
              <Pressable
                onPress={() => {
                  const ids = safeGroupMembers.map((m) => m.id).join(",");
                  if (ids) {
                    router.push({
                      pathname: "/(protected)/call/[roomId]",
                      params: {
                        roomId: `call-${Date.now()}`,
                        isOutgoing: "true",
                        participantIds: ids,
                        callType: "audio",
                        chatId: chatId,
                        recipientUsername: groupName || "Group",
                        recipientAvatar: groupMembers[0]?.avatar || "",
                      },
                    });
                  }
                }}
                className="p-2 rounded-full bg-primary/20"
                hitSlop={12}
              >
                <Phone size={22} color="#3EA4E5" />
              </Pressable>
              {/* Group Video Call */}
              <Pressable
                onPress={() => {
                  const ids = safeGroupMembers.map((m) => m.id).join(",");
                  if (ids) {
                    router.push({
                      pathname: "/(protected)/call/[roomId]",
                      params: {
                        roomId: `call-${Date.now()}`,
                        isOutgoing: "true",
                        participantIds: ids,
                        callType: "video",
                        chatId: chatId,
                        recipientUsername: groupName || "Group",
                        recipientAvatar: groupMembers[0]?.avatar || "",
                      },
                    });
                  }
                }}
                className="p-2 rounded-full bg-primary/20"
                hitSlop={12}
              >
                <Video size={22} color="#3EA4E5" />
              </Pressable>
            </>
          ) : (
            /* ── 1:1 chat header ── */
            <>
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
            </>
          )}
        </View>

        <KeyboardGestureArea
          interpolator="ios"
          style={{ flex: 1 }}
          textInputNativeID="chat-input"
        >
          <LegendList
            ref={listRef}
            data={chatMessages}
            extraData={chatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
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
                            isMe
                              ? "text-foreground/70"
                              : "text-muted-foreground"
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
                            isMe
                              ? "text-foreground/70"
                              : "text-muted-foreground"
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

              const isFailed = isMe && item.status === "failed";
              const isMsgSending = isMe && item.status === "sending";

              const messageContent = isMe ? (
                <View
                  className="flex-row items-end gap-2 mb-2 self-end"
                  style={{ maxWidth: "80%", opacity: isMsgSending ? 0.6 : 1 }}
                >
                  <View style={{ flexShrink: 1 }}>
                    {isFailed ? (
                      <Pressable
                        onPress={() => {
                          const convId = resolvedConvIdRef.current || chatId;
                          retryMessage(convId, item.id);
                        }}
                      >
                        {bubble}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            marginTop: 2,
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#ef4444",
                              fontWeight: "600",
                            }}
                          >
                            Not sent · Tap to retry
                          </Text>
                        </View>
                      </Pressable>
                    ) : (
                      bubble
                    )}
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
                                showToast(
                                  "success",
                                  "Unsent",
                                  "Message removed",
                                );
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
              {isResolvingConversation ? (
                <View className="flex-1 flex-row items-center justify-center gap-2 py-3">
                  <View className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <Text className="text-muted-foreground text-sm">
                    Setting up chat...
                  </Text>
                </View>
              ) : (
                <>
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
                    nativeID="chat-input"
                    value={currentMessage}
                    onChangeText={handleTextChange}
                    onSelectionChange={handleSelectionChange}
                    placeholder="Message... (use @ to mention)"
                    placeholderTextColor="#666"
                    className="flex-1 min-h-[40px] max-h-[100px] bg-secondary rounded-full px-4 py-2.5 text-foreground"
                    multiline
                  />
                </>
              )}

              <Animated.View
                style={{ transform: [{ scale: sendButtonScale }] }}
              >
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
        </KeyboardGestureArea>

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

// Wrap with ErrorBoundary for crash protection
export default function ChatScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="Chat"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
    >
      <ChatScreenContent />
    </ErrorBoundary>
  );
}
