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

        // Detect story reply messages
        let storyReply: StoryReplyContext | undefined;
        let displayText = content;

        // Format 1: Structured JSON prefix — [STORY_REPLY:{"storyId":...}] reply text
        const structuredMatch = content.match(
          /^\[STORY_REPLY:(.*?)\]\s*([\s\S]*)$/,
        );
        // Format 2: Legacy simple prefix — 📷 Replied to your story: reply text
        const legacyPrefix = "📷 Replied to your story: ";

        if (structuredMatch) {
          try {
            const meta = JSON.parse(structuredMatch[1]);
            displayText = structuredMatch[2] || "";
            storyReply = {
              storyId: meta.storyId || "",
              storyMediaUrl: meta.storyMediaUrl,
              storyUsername: meta.storyUsername || "",
              storyAvatar: meta.storyAvatar,
              isExpired: meta.isExpired ?? false,
            };
          } catch {
            // JSON parse failed — treat as normal message
          }
        } else if (content.startsWith(legacyPrefix)) {
          displayText = content.slice(legacyPrefix.length);
          storyReply = {
            storyId: "",
            storyMediaUrl: undefined,
            storyUsername: isSender ? "" : user?.username || "",
            storyAvatar: undefined,
            isExpired: true, // Legacy messages have no media URL, show as expired
          };
        }

        return {
          id: String(msg.id),
          text: displayText,
          sender: isSender ? ("me" as const) : ("them" as const),
          time: new Date(msg.createdAt || msg.timestamp).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
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

    set({ isSending: true });

    try {
      // Prepare media for upload
      let mediaItems: Array<{ uri: string; type: "image" | "video" }> = [];
      if (pendingMedia) {
        mediaItems = [{ uri: pendingMedia.uri, type: pendingMedia.type }];
      }

      // Send via API (handles Bunny upload internally)
      const result = await messagesApiClient.sendMessage({
        conversationId,
        content: currentMessage || "",
        media: mediaItems.length > 0 ? mediaItems : undefined,
      });

      if (result) {
        // Add to local state
        const existingMessages = messages[conversationId] || [];
        const newMessage: Message = {
          id: result.id,
          text: result.content,
          sender: "me",
          time: new Date(result.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          media:
            result.media.length > 0
              ? {
                  type: result.media[0].type,
                  uri: result.media[0].url,
                }
              : undefined,
        };

        set({
          messages: {
            ...messages,
            [conversationId]: [...existingMessages, newMessage],
          },
          currentMessage: "",
          mentionQuery: "",
          showMentions: false,
          pendingMedia: null,
          isSending: false,
        });
      } else {
        set({ isSending: false });
      }
    } catch (error) {
      console.error("[ChatStore] sendMessageToBackend error:", error);
      set({ isSending: false });
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
