/**
 * Chat API: Supabase Integration
 * Production-ready with proper error handling
 */

import { supabase } from '@/lib/supabase/client';
import {
  Conversation,
  ConversationWithDetails,
  Message,
  MessagePage,
  MessageReaction,
  ConversationMember,
} from './types';

const PAGE_SIZE = 50;

/**
 * Get user's conversations (sorted by most recent)
 */
export async function getConversations(): Promise<ConversationWithDetails[]> {
  console.log('[Chat] Fetching conversations');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user ID from users table
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');
  const userId = userData.id;

  // Get conversations with last message and members
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_members!inner(
        id,
        user_id,
        role,
        joined_at,
        last_read_at,
        notifications_enabled,
        user:users(id, username, first_name, avatar_id)
      )
    `)
    .eq('conversation_members.user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[Chat] Error fetching conversations:', error);
    throw error;
  }

  // Get unread counts and last messages
  const conversationsWithDetails = await Promise.all(
    (data || []).map(async (conv) => {
      // Get last message
      const { data: lastMessage } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users(id, username, first_name, avatar_id)
        `)
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get unread count
      const { data: unreadData } = await supabase.rpc('get_unread_count', {
        p_conversation_id: conv.id,
        p_user_id: userId,
      });

      return {
        ...transformConversation(conv),
        members: conv.conversation_members.map(transformMember),
        lastMessage: lastMessage ? transformMessage(lastMessage) : null,
        unreadCount: unreadData || 0,
      };
    })
  );

  return conversationsWithDetails;
}

/**
 * Get conversation by ID with full details
 */
export async function getConversation(
  conversationId: number
): Promise<ConversationWithDetails | null> {
  console.log('[Chat] Fetching conversation:', conversationId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');
  const userId = userData.id;

  // Get conversation with members
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_members(
        id,
        user_id,
        role,
        joined_at,
        last_read_at,
        notifications_enabled,
        user:users(id, username, first_name, avatar_id)
      )
    `)
    .eq('id', conversationId)
    .single();

  if (error || !conv) {
    console.error('[Chat] Error fetching conversation:', error);
    return null;
  }

  // Get last message
  const { data: lastMessage } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users(id, username, first_name, avatar_id)
    `)
    .eq('conversation_id', conv.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get unread count
  const { data: unreadData } = await supabase.rpc('get_unread_count', {
    p_conversation_id: conv.id,
    p_user_id: userId,
  });

  return {
    ...transformConversation(conv),
    members: (conv.conversation_members || []).map(transformMember),
    lastMessage: lastMessage ? transformMessage(lastMessage) : null,
    unreadCount: unreadData || 0,
  };
}

/**
 * Get messages for conversation (paginated, newest first)
 */
export async function getMessages(
  conversationId: number,
  beforeId?: number
): Promise<MessagePage> {
  console.log('[Chat] Fetching messages:', { conversationId, beforeId });

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:users(id, username, first_name, avatar_id),
      reply_to:messages!reply_to_message_id(
        id,
        text,
        sender:users(username)
      ),
      reactions:message_reactions(
        id,
        user_id,
        emoji,
        user:users(id, username)
      )
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (beforeId) {
    query = query.lt('id', beforeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Chat] Error fetching messages:', error);
    throw error;
  }

  const messages = (data || []).map(transformMessage).reverse(); // Reverse for chronological order

  return {
    messages,
    hasMore: messages.length === PAGE_SIZE,
    oldestMessageId: messages.length > 0 ? messages[0].id : null,
  };
}

/**
 * Send a text message
 */
export async function sendMessage(
  conversationId: number,
  text: string,
  replyToMessageId?: number
): Promise<Message> {
  console.log('[Chat] Sending message');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userData.id,
      type: 'text',
      text: text.trim(),
      reply_to_message_id: replyToMessageId || null,
    })
    .select(`
      *,
      sender:users(id, username, first_name, avatar_id)
    `)
    .single();

  if (error) {
    console.error('[Chat] Error sending message:', error);
    throw error;
  }

  return transformMessage(data);
}

/**
 * Send a media message
 */
export async function sendMediaMessage(
  conversationId: number,
  mediaUrl: string,
  type: 'image' | 'video',
  text?: string,
  dimensions?: { width: number; height: number; duration?: number }
): Promise<Message> {
  console.log('[Chat] Sending media message');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userData.id,
      type,
      text: text?.trim() || null,
      media_url: mediaUrl,
      media_width: dimensions?.width || null,
      media_height: dimensions?.height || null,
      media_duration: dimensions?.duration || null,
    })
    .select(`
      *,
      sender:users(id, username, first_name, avatar_id)
    `)
    .single();

  if (error) {
    console.error('[Chat] Error sending media message:', error);
    throw error;
  }

  return transformMessage(data);
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId: number): Promise<void> {
  console.log('[Chat] Deleting message:', messageId);

  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) {
    console.error('[Chat] Error deleting message:', error);
    throw error;
  }
}

/**
 * Add reaction to message
 */
export async function addReaction(
  messageId: number,
  emoji: string
): Promise<MessageReaction> {
  console.log('[Chat] Adding reaction:', { messageId, emoji });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: userData.id,
      emoji,
    })
    .select(`
      *,
      user:users(id, username)
    `)
    .single();

  if (error) {
    console.error('[Chat] Error adding reaction:', error);
    throw error;
  }

  return transformReaction(data);
}

/**
 * Remove reaction from message
 */
export async function removeReaction(
  messageId: number,
  emoji: string
): Promise<void> {
  console.log('[Chat] Removing reaction:', { messageId, emoji });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userData.id)
    .eq('emoji', emoji);

  if (error) {
    console.error('[Chat] Error removing reaction:', error);
    throw error;
  }
}

/**
 * Mark conversation as read
 */
export async function markConversationRead(conversationId: number): Promise<void> {
  console.log('[Chat] Marking conversation as read:', conversationId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    p_user_id: userData.id,
  });

  if (error) {
    console.error('[Chat] Error marking as read:', error);
    throw error;
  }
}

/**
 * Create a group conversation
 */
export async function createGroupConversation(
  title: string,
  memberIds: number[]
): Promise<Conversation> {
  console.log('[Chat] Creating group conversation');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!userData) throw new Error('User not found');

  // Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      title,
      is_group: true,
      created_by: userData.id,
    })
    .select()
    .single();

  if (convError || !conversation) {
    console.error('[Chat] Error creating conversation:', convError);
    throw convError;
  }

  // Add creator as admin
  const members = [
    { conversation_id: conversation.id, user_id: userData.id, role: 'admin' },
    ...memberIds.map(id => ({
      conversation_id: conversation.id,
      user_id: id,
      role: 'member' as const,
    })),
  ];

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(members);

  if (membersError) {
    console.error('[Chat] Error adding members:', membersError);
    throw membersError;
  }

  return transformConversation(conversation);
}

// ============================================================================
// TRANSFORMERS (DB → App types)
// ============================================================================

function transformConversation(data: any): Conversation {
  return {
    id: data.id,
    title: data.title,
    isGroup: data.is_group,
    createdBy: data.created_by,
    avatarUrl: data.avatar_url,
    lastMessageAt: data.last_message_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformMember(data: any): ConversationMember {
  return {
    id: data.id,
    conversationId: data.conversation_id,
    userId: data.user_id,
    role: data.role,
    joinedAt: data.joined_at,
    lastReadAt: data.last_read_at,
    notificationsEnabled: data.notifications_enabled,
    user: data.user ? {
      id: data.user.id,
      username: data.user.username,
      firstName: data.user.first_name,
      avatar: data.user.avatar_id?.url || null,
    } : undefined,
  };
}

function transformMessage(data: any): Message {
  const reactions = data.reactions || [];
  const reactionCounts: Record<string, number> = {};
  
  reactions.forEach((r: any) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    type: data.type,
    text: data.text,
    mediaUrl: data.media_url,
    mediaWidth: data.media_width,
    mediaHeight: data.media_height,
    mediaDuration: data.media_duration,
    replyToMessageId: data.reply_to_message_id,
    deletedAt: data.deleted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    sender: data.sender ? {
      id: data.sender.id,
      username: data.sender.username,
      firstName: data.sender.first_name,
      avatar: data.sender.avatar_id?.url || null,
    } : undefined,
    replyToMessage: data.reply_to ? transformMessage(data.reply_to) : undefined,
    reactions: reactions.map(transformReaction),
    reactionCounts,
  };
}

function transformReaction(data: any): MessageReaction {
  return {
    id: data.id,
    messageId: data.message_id,
    userId: data.user_id,
    emoji: data.emoji,
    createdAt: data.created_at,
    user: data.user ? {
      id: data.user.id,
      username: data.user.username,
    } : undefined,
  };
}
