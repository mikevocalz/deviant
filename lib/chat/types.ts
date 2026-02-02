/**
 * Group Chat Types
 * Production-grade TypeScript definitions
 */

export type MessageType = 'text' | 'image' | 'video' | 'system';
export type MemberRole = 'admin' | 'member';

export interface Conversation {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdBy: number;
  avatarUrl: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Computed fields (from joins)
  members?: ConversationMember[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ConversationMember {
  id: number;
  conversationId: number;
  userId: number;
  role: MemberRole;
  joinedAt: string;
  lastReadAt: string | null;
  notificationsEnabled: boolean;
  
  // User info (from join)
  user?: {
    id: number;
    username: string;
    firstName: string | null;
    avatar: string | null;
  };
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaDuration: number | null;
  replyToMessageId: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Computed fields
  sender?: {
    id: number;
    username: string;
    firstName: string | null;
    avatar: string | null;
  };
  replyToMessage?: Message;
  reactions?: MessageReaction[];
  reactionCounts?: Record<string, number>;
  isOptimistic?: boolean;   // For optimistic updates
  optimisticId?: string;     // Temp ID before server confirmation
}

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
  
  // User info
  user?: {
    id: number;
    username: string;
  };
}

export interface TypingIndicator {
  userId: number;
  username: string;
  conversationId: number;
  timestamp: number;
}

export interface UserPresence {
  userId: number;
  username: string;
  online: boolean;
  lastSeen: string;
}

// Realtime payload types
export interface RealtimeMessagePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Message;
  old: Message | null;
}

export interface RealtimeReactionPayload {
  eventType: 'INSERT' | 'DELETE';
  new: MessageReaction;
  old: MessageReaction | null;
}

// UI State
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  typingUsers: TypingIndicator[];
  onlineUsers: Set<number>;
}

// API Response types
export interface ConversationWithDetails extends Conversation {
  members: ConversationMember[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  oldestMessageId: number | null;
}
