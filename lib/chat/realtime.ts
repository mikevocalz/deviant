/**
 * Supabase Realtime Hooks for Group Chat
 * Production-ready with proper cleanup and error handling
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import {
  Message,
  MessageReaction,
  TypingIndicator,
  RealtimeMessagePayload,
  RealtimeReactionPayload,
} from './types';

/**
 * Subscribe to new messages in a conversation
 * Receives INSERT events in real-time
 * 
 * @example
 * useMessagesSubscription(conversationId, (message) => {
 *   setMessages(prev => [...prev, message]);
 * });
 */
export function useMessagesSubscription(
  conversationId: number | null,
  onMessage: (message: Message) => void,
  onReaction: (reaction: MessageReaction, type: 'added' | 'removed') => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `conversation:${conversationId}`;
    console.log('[Realtime] Subscribing to:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[Realtime] New message:', payload);
          
          // Fetch full message with sender info
          supabase
            .from('messages')
            .select(`
              *,
              sender:users(id, username, first_name, avatar_id)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                onMessage({
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
                  reactions: [],
                  reactionCounts: {},
                });
              }
            });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          console.log('[Realtime] New reaction:', payload);
          onReaction(
            {
              id: payload.new.id,
              messageId: payload.new.message_id,
              userId: payload.new.user_id,
              emoji: payload.new.emoji,
              createdAt: payload.new.created_at,
            },
            'added'
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          console.log('[Realtime] Reaction removed:', payload);
          onReaction(
            {
              id: payload.old.id,
              messageId: payload.old.message_id,
              userId: payload.old.user_id,
              emoji: payload.old.emoji,
              createdAt: payload.old.created_at,
            },
            'removed'
          );
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Unsubscribing from:', channelName);
      channel.unsubscribe();
    };
  }, [conversationId, onMessage, onReaction]);
}

/**
 * Typing indicator system using Realtime broadcast
 * Broadcasts typing status and receives others' typing status
 * 
 * @example
 * const { sendTyping, typingUsers } = useTypingIndicators(conversationId, currentUserId);
 * 
 * // Call on input change
 * onChangeText={(text) => {
 *   setText(text);
 *   sendTyping();
 * });
 */
export function useTypingIndicators(
  conversationId: number | null,
  currentUserId: number | null,
  currentUsername: string | null
) {
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send typing indicator (debounced)
  const sendTyping = useCallback(() => {
    if (!channelRef.current || !conversationId || !currentUserId) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Broadcast typing event
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUserId,
        username: currentUsername,
        conversationId,
        timestamp: Date.now(),
      },
    });

    // Auto-clear after 3 seconds
    timeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing_stopped',
          payload: {
            userId: currentUserId,
            conversationId,
          },
        });
      }
    }, 3000);
  }, [conversationId, currentUserId, currentUsername]);

  useEffect(() => {
    if (!conversationId) return;

    const channelName = `typing:${conversationId}`;
    console.log('[Realtime] Setting up typing channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        // Ignore own typing events
        if (payload.userId === currentUserId) return;

        setTypingUsers((prev) => {
          // Remove existing entry for this user
          const filtered = prev.filter((u) => u.userId !== payload.userId);
          
          // Add new entry
          return [...filtered, {
            userId: payload.userId,
            username: payload.username,
            conversationId: payload.conversationId,
            timestamp: payload.timestamp,
          }];
        });

        // Auto-remove after 5 seconds (fallback)
        setTimeout(() => {
          setTypingUsers((prev) => 
            prev.filter((u) => u.userId !== payload.userId || Date.now() - u.timestamp < 5000)
          );
        }, 5000);
      })
      .on('broadcast', { event: 'typing_stopped' }, ({ payload }) => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  // Auto-cleanup stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        return prev.filter((u) => now - u.timestamp < 5000);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return {
    sendTyping,
    typingUsers: typingUsers.filter((u) => u.conversationId === conversationId),
  };
}

/**
 * User presence system using Supabase Presence API
 * Tracks who's online in the conversation
 * 
 * @example
 * const { onlineUsers } = usePresence(conversationId, currentUserId);
 */
export function usePresence(
  conversationId: number | null,
  currentUserId: number | null,
  currentUsername: string | null
) {
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channelName = `presence:${conversationId}`;
    console.log('[Realtime] Setting up presence:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          user_id: number;
          username: string;
          online_at: string;
        }>();

        console.log('[Realtime] Presence sync:', state);

        // Extract online user IDs
        const online = new Set<number>();
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            online.add(presence.user_id);
          });
        });

        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Realtime] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Realtime] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          const presenceStatus = await channel.track({
            user_id: currentUserId,
            username: currentUsername,
            online_at: new Date().toISOString(),
          });
          console.log('[Realtime] Presence tracked:', presenceStatus);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Untracking presence');
      channel.untrack();
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId, currentUsername]);

  return {
    onlineUsers,
    isOnline: (userId: number) => onlineUsers.has(userId),
  };
}

/**
 * Combined hook for complete chat realtime functionality
 * Handles messages, reactions, typing, and presence
 * 
 * @example
 * const {
 *   sendTyping,
 *   typingUsers,
 *   onlineUsers,
 * } = useChatRealtime(
 *   conversationId,
 *   currentUserId,
 *   (message) => addMessage(message),
 *   (reaction, type) => handleReaction(reaction, type)
 * );
 */
export function useChatRealtime(
  conversationId: number | null,
  currentUserId: number | null,
  currentUsername: string | null,
  onMessage: (message: Message) => void,
  onReaction: (reaction: MessageReaction, type: 'added' | 'removed') => void
) {
  // Subscribe to messages
  useMessagesSubscription(conversationId, onMessage, onReaction);

  // Typing indicators
  const typing = useTypingIndicators(conversationId, currentUserId, currentUsername);

  // Presence
  const presence = usePresence(conversationId, currentUserId, currentUsername);

  return {
    ...typing,
    ...presence,
  };
}
