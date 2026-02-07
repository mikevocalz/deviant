import { create } from "zustand";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";
import { uploadToBunny } from "@/lib/bunny-storage";
import { useAuthStore } from "@/lib/stores/auth-store";

export interface MediaAttachment {
  type: "image" | "video";
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface StoryReplyContext {
  storyId: string;
  storyMediaUrl?: string;
  storyUsername: string;
  storyAvatar?: string;
  isExpired?: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  mentions?: string[];
  media?: MediaAttachment;
  storyReply?: StoryReplyContext;
}

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
}

interface ChatState {
  messages: Record<string, Message[]>;
  currentMessage: string;
  mentionQuery: string;
  showMentions: boolean;
  cursorPosition: number;
  pendingMedia: MediaAttachment | null;
  isSending: boolean;
  setCurrentMessage: (message: string) => void;
  setMentionQuery: (query: string) => void;
  setShowMentions: (show: boolean) => void;
  setCursorPosition: (position: number) => void;
  setPendingMedia: (media: MediaAttachment | null) => void;
  sendMessage: (chatId: string) => void;
  sendMessageToBackend: (conversationId: string) => Promise<void>;
  sendMediaMessage: (
    chatId: string,
    media: MediaAttachment,
    caption?: string,
  ) => void;
  initializeChat: (chatId: string, initialMessages: Message[]) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  insertMention: (username: string) => void;
}

// Empty array - messages will come from backend
const mockMessages: Message[] = [];

// TODO: Replace with real users from backend
export const allUsers: User[] = [];

function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

function getCurrentMentionQuery(
  text: string,
  cursorPosition: number,
): string | null {
  const beforeCursor = text.slice(0, cursorPosition);
  const match = beforeCursor.match(/@(\w*)$/);
  return match ? match[1] : null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  currentMessage: "",
  mentionQuery: "",
  showMentions: false,
  cursorPosition: 0,
  pendingMedia: null,
  isSending: false,

  setPendingMedia: (media) => set({ pendingMedia: media }),

  // Load messages from backend
  loadMessages: async (conversationId: string) => {
    try {
      const user = useAuthStore.getState().user;
      const backendMessages =
        await messagesApiClient.getMessages(conversationId);

      // Transform to local message format
      const localMessages: Message[] = backendMessages.map((msg: any) => {
        const content = msg.content || msg.text || "";
        const isSender = (msg.sender?.id || msg.sender) === user?.id;

        // Detect story reply messages via metadata (preferred) or legacy content prefix
        let storyReply: StoryReplyContext | undefined;
        let displayText = content;
        const meta = msg.metadata;

        if (meta && meta.type === "story_reply") {
          // New format: metadata JSONB column from backend
          storyReply = {
            storyId: meta.storyId || "",
            storyMediaUrl: meta.storyMediaUrl || undefined,
            storyUsername: meta.storyUsername || "",
            storyAvatar: meta.storyAvatar || undefined,
            isExpired: !meta.storyMediaUrl,
          };
        } else {
          // Legacy fallback: parse "📷 Replied to your story: " prefix
          const legacyPrefix = "📷 Replied to your story: ";
          if (content.startsWith(legacyPrefix)) {
            displayText = content.slice(legacyPrefix.length);
            storyReply = {
              storyId: "",
              storyMediaUrl: undefined,
              storyUsername: isSender ? "" : user?.username || "",
              storyAvatar: undefined,
              isExpired: true,
            };
          }
        }

        return {
          id: String(msg.id),
          text: displayText,
          sender: isSender ? ("me" as const) : ("them" as const),
          time: (() => {
            try {
              const d = new Date(
                msg.createdAt || msg.created_at || msg.timestamp,
              );
              return isNaN(d.getTime())
                ? ""
                : d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
            } catch {
              return "";
            }
          })(),
          media:
            msg.media && msg.media.length > 0
              ? {
                  type: msg.media[0].type,
                  uri: msg.media[0].url,
                }
              : undefined,
          storyReply,
        };
      });

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: localMessages,
        },
      }));
    } catch (error) {
      console.error("[ChatStore] loadMessages error:", error);
    }
  },

  // Send message to backend with Bunny CDN upload
  sendMessageToBackend: async (conversationId: string) => {
    const { currentMessage, pendingMedia, messages } = get();
    if (!currentMessage.trim() && !pendingMedia) return;

    const user = useAuthStore.getState().user;
    if (!user) {
      console.error("[ChatStore] User not logged in");
      return;
    }

    // Capture values before clearing
    const messageText = currentMessage;
    const mediaToSend = pendingMedia;

    // CRITICAL: Clear input immediately (optimistic) so user sees it reset
    set({
      currentMessage: "",
      mentionQuery: "",
      showMentions: false,
      pendingMedia: null,
      isSending: true,
    });

    try {
      // Prepare media for upload
      let mediaItems: Array<{ uri: string; type: "image" | "video" }> = [];
      if (mediaToSend) {
        mediaItems = [{ uri: mediaToSend.uri, type: mediaToSend.type }];
      }

      // Send via API (handles Bunny upload internally)
      const result = await messagesApiClient.sendMessage({
        conversationId,
        content: messageText || "",
        media: mediaItems.length > 0 ? mediaItems : undefined,
      });

      if (result) {
        // Parse time safely — handle missing or invalid createdAt
        let timeStr: string;
        try {
          const d = new Date(result.createdAt || result.created_at);
          timeStr = isNaN(d.getTime())
            ? new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
          timeStr = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        // Parse media safely — server may return media array or nothing
        const serverMedia =
          Array.isArray(result.media) && result.media.length > 0
            ? {
                type: result.media[0].type as "image" | "video",
                uri: result.media[0].url,
              }
            : mediaToSend
              ? { type: mediaToSend.type, uri: mediaToSend.uri }
              : undefined;

        const existingMessages = get().messages[conversationId] || [];
        const newMessage: Message = {
          id: result.id || String(Date.now()),
          text: result.content || result.text || messageText,
          sender: "me",
          time: timeStr,
          media: serverMedia,
        };

        set({
          messages: {
            ...get().messages,
            [conversationId]: [...existingMessages, newMessage],
          },
          isSending: false,
        });
      } else {
        set({ isSending: false });
      }
    } catch (error) {
      console.error("[ChatStore] sendMessageToBackend error:", error);
      // Restore message on error so user doesn't lose their text
      set({
        currentMessage: messageText,
        pendingMedia: mediaToSend,
        isSending: false,
      });
    }
  },

  setCurrentMessage: (message) => {
    const { cursorPosition } = get();
    const query = getCurrentMentionQuery(message, cursorPosition);

    set({
      currentMessage: message,
      mentionQuery: query || "",
      showMentions: query !== null,
    });
  },

  setMentionQuery: (query) => set({ mentionQuery: query }),
  setShowMentions: (show) => set({ showMentions: show }),
  setCursorPosition: (position) => {
    const { currentMessage } = get();
    const query = getCurrentMentionQuery(currentMessage, position);
    set({
      cursorPosition: position,
      mentionQuery: query || "",
      showMentions: query !== null,
    });
  },

  sendMessage: (chatId) => {
    const { currentMessage, messages, pendingMedia } = get();
    if (!currentMessage.trim() && !pendingMedia) return;

    const existingMessages = messages[chatId] || [...mockMessages];
    const mentions = extractMentions(currentMessage);

    const newMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage || "",
      sender: "me",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mentions: mentions.length > 0 ? mentions : undefined,
      media: pendingMedia || undefined,
    };

    set({
      messages: {
        ...messages,
        [chatId]: [...existingMessages, newMessage],
      },
      currentMessage: "",
      mentionQuery: "",
      showMentions: false,
      pendingMedia: null,
    });
  },

  sendMediaMessage: (chatId, media, caption) => {
    const { messages } = get();
    const existingMsgs = messages[chatId] || mockMessages;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: caption || "",
      sender: "me",
      time: "Now",
      media,
    };

    set({
      messages: {
        ...messages,
        [chatId]: [...existingMsgs, newMessage],
      },
    });
  },

  initializeChat: (chatId, initialMessages) => {
    const { messages } = get();
    if (!messages[chatId]) {
      set({
        messages: {
          ...messages,
          [chatId]: initialMessages,
        },
      });
    }
  },

  insertMention: (username) => {
    const { currentMessage, cursorPosition } = get();
    const beforeCursor = currentMessage.slice(0, cursorPosition);
    const afterCursor = currentMessage.slice(cursorPosition);

    const mentionStart = beforeCursor.lastIndexOf("@");
    const newBefore = beforeCursor.slice(0, mentionStart);
    const newMessage = `${newBefore}@${username} ${afterCursor}`;
    const newCursorPosition = newBefore.length + username.length + 2;

    set({
      currentMessage: newMessage,
      cursorPosition: newCursorPosition,
      mentionQuery: "",
      showMentions: false,
    });
  },
}));
