import { create } from "zustand";

export interface MediaAttachment {
  type: "image" | "video";
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  mentions?: string[];
  media?: MediaAttachment;
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
  setCurrentMessage: (message: string) => void;
  setMentionQuery: (query: string) => void;
  setShowMentions: (show: boolean) => void;
  setCursorPosition: (position: number) => void;
  setPendingMedia: (media: MediaAttachment | null) => void;
  sendMessage: (chatId: string) => void;
  sendMediaMessage: (
    chatId: string,
    media: MediaAttachment,
    caption?: string,
  ) => void;
  initializeChat: (chatId: string, initialMessages: Message[]) => void;
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

  setPendingMedia: (media) => set({ pendingMedia: media }),

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
