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

export interface SharedPostContext {
  postId: string;
  authorUsername: string;
  authorAvatar: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  username: string;
}

export interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  senderId?: string;
  time: string;
  mentions?: string[];
  media?: MediaAttachment;
  storyReply?: StoryReplyContext;
  sharedPost?: SharedPostContext;
  reactions?: MessageReaction[];
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
  sendSharedPost: (
    conversationId: string,
    post: SharedPostContext,
  ) => Promise<void>;
  initializeChat: (chatId: string, initialMessages: Message[]) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  insertMention: (username: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  editMessage: (
    conversationId: string,
    messageId: string,
    newText: string,
  ) => Promise<void>;
  reactToMessage: (
    conversationId: string,
    messageId: string,
    emoji: string,
  ) => Promise<void>;
  addSystemMessage: (chatId: string, text: string) => void;
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

        // INVARIANT: API MUST return sender as "user" or "other" (string literals).
        // Any other value (object, ID, undefined) = broken contract → default to "other"
        // to prevent showing YOUR messages as theirs. SEE: CLAUDE.md messages section.
        if (__DEV__ && msg.sender !== "user" && msg.sender !== "other") {
          console.error(
            `[ChatStore] INVARIANT VIOLATION: msg.sender must be "user" or "other", got:`,
            JSON.stringify(msg.sender),
            `(type: ${typeof msg.sender}). Message ID: ${msg.id}`,
          );
        }
        const isSender = msg.sender === "user";

        // Detect story reply messages via metadata (preferred) or legacy content prefix
        let storyReply: StoryReplyContext | undefined;
        let displayText = content;
        const meta = msg.metadata;

        if (
          meta &&
          (meta.type === "story_reply" || meta.type === "story_reaction")
        ) {
          // New format: metadata JSONB column from backend
          // Stories expire after 24h — check if the story is still active
          const storyExpired = meta.storyExpiresAt
            ? new Date(meta.storyExpiresAt) < new Date()
            : false; // Default to not expired if no expiry info
          storyReply = {
            storyId: meta.storyId || "",
            storyMediaUrl: meta.storyMediaUrl || undefined,
            storyUsername: meta.storyUsername || "",
            storyAvatar: meta.storyAvatar || undefined,
            isExpired: storyExpired,
          };
          // For story reactions, the content is just the emoji — keep it as displayText
          // so StoryReplyBubble shows "Reacted ❤️ to your story"
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

        // Detect shared post messages via metadata
        let sharedPost: SharedPostContext | undefined;
        if (meta && meta.type === "shared_post") {
          sharedPost = {
            postId: meta.postId || "",
            authorUsername: meta.authorUsername || "",
            authorAvatar: meta.authorAvatar || "",
            caption: meta.caption || undefined,
            mediaUrl: meta.mediaUrl || undefined,
            mediaType: meta.mediaType || undefined,
          };
        }

        return {
          id: String(msg.id),
          text: displayText,
          sender: isSender ? ("me" as const) : ("them" as const),
          senderId: msg.senderId ? String(msg.senderId) : undefined,
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
              : meta?.mediaUrl &&
                  meta.type !== "shared_post" &&
                  meta.type !== "story_reply"
                ? {
                    type: (meta.mediaType as "image" | "video") || "image",
                    uri: meta.mediaUrl as string,
                  }
                : undefined,
          storyReply,
          sharedPost,
          reactions: (() => {
            const r = meta?.reactions;
            return Array.isArray(r) ? r : [];
          })(),
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
    const { currentMessage, pendingMedia, messages, isSending } = get();
    if (isSending) return; // Re-entrance guard
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
      // Upload media to Bunny CDN first, then send CDN URL
      let mediaItems: Array<{ uri: string; type: "image" | "video" }> = [];
      let uploadedMediaUrl: string | undefined;
      if (mediaToSend) {
        try {
          const uploadResult = await uploadToBunny(mediaToSend.uri, "chat");
          if (uploadResult.success && uploadResult.url) {
            uploadedMediaUrl = uploadResult.url;
            mediaItems = [{ uri: uploadResult.url, type: mediaToSend.type }];
          }
        } catch (uploadError) {
          console.error("[ChatStore] Bunny upload failed:", uploadError);
          // Fall back to local URI
          mediaItems = [{ uri: mediaToSend.uri, type: mediaToSend.type }];
        }
      }

      // Send via API with CDN URL
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

        // Parse media safely — check result.media array, then metadata.mediaUrl, then local fallback
        const resMeta = result.metadata;
        const serverMedia =
          Array.isArray(result.media) && result.media.length > 0
            ? {
                type: result.media[0].type as "image" | "video",
                uri: result.media[0].url,
              }
            : resMeta?.mediaUrl
              ? {
                  type: (resMeta.mediaType as "image" | "video") || "image",
                  uri: resMeta.mediaUrl as string,
                }
              : mediaToSend
                ? {
                    type: mediaToSend.type,
                    uri: uploadedMediaUrl || mediaToSend.uri,
                  }
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

  sendSharedPost: async (conversationId, post) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Optimistic local message
    const optimisticMsg: Message = {
      id: `shared-${Date.now()}`,
      text: "",
      sender: "me",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      sharedPost: post,
    };

    const existing = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: [...existing, optimisticMsg],
      },
    });

    try {
      await messagesApiClient.sendMessage({
        conversationId,
        content: `Shared a post by @${post.authorUsername}`,
        metadata: {
          type: "shared_post",
          postId: post.postId,
          authorUsername: post.authorUsername,
          authorAvatar: post.authorAvatar,
          caption: post.caption || "",
          mediaUrl: post.mediaUrl || "",
          mediaType: post.mediaType || "image",
        },
      });
    } catch (error) {
      console.error("[ChatStore] sendSharedPost error:", error);
      // Remove optimistic message on failure
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).filter(
            (m) => m.id !== optimisticMsg.id,
          ),
        },
      }));
    }
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

  deleteMessage: async (conversationId, messageId) => {
    try {
      // Optimistic: remove from local state immediately
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).filter(
            (m) => m.id !== messageId,
          ),
        },
      }));

      // Delete from backend
      await messagesApiClient.deleteMessage(messageId);
    } catch (error) {
      console.error("[ChatStore] deleteMessage error:", error);
      // Reload messages to restore correct state on failure
      await get().loadMessages(conversationId);
    }
  },

  editMessage: async (conversationId, messageId, newText) => {
    const oldMessages = get().messages[conversationId] || [];
    try {
      // Optimistic: update local state immediately
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, text: newText } : m,
          ),
        },
      }));

      // Update on backend
      await messagesApiClient.editMessage(messageId, newText);
    } catch (error) {
      console.error("[ChatStore] editMessage error:", error);
      // Restore old messages on failure
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: oldMessages,
        },
      }));
    }
  },

  reactToMessage: async (conversationId, messageId, emoji) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const reaction: MessageReaction = {
      emoji,
      userId: user.id,
      username: user.username,
    };

    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions || [];
          // Toggle: remove if same emoji from same user, otherwise add
          const alreadyReacted = existing.find(
            (r) => r.emoji === emoji && r.userId === user.id,
          );
          const newReactions = alreadyReacted
            ? existing.filter(
                (r) => !(r.emoji === emoji && r.userId === user.id),
              )
            : [...existing, reaction];
          return { ...m, reactions: newReactions };
        }),
      },
    }));

    try {
      await messagesApiClient.reactToMessage(messageId, emoji);
    } catch (error) {
      console.error("[ChatStore] reactToMessage error:", error);
      // Reload messages to restore correct state on failure
      await get().loadMessages(conversationId);
    }
  },

  addSystemMessage: (chatId, text) => {
    const existing = get().messages[chatId] || [];
    const systemMsg: Message = {
      id: `system-${Date.now()}`,
      text,
      sender: "them",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    set({
      messages: {
        ...get().messages,
        [chatId]: [...existing, systemMsg],
      },
    });
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
