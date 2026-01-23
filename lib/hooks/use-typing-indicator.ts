/**
 * Typing Indicator Hook
 *
 * Senior engineer approach:
 * - Debounced typing events using TanStack Pacer
 * - Auto-clear after timeout (like FB/Instagram)
 * - Polling for real-time updates (WebSocket would be better for scale)
 * - Memory-efficient with cleanup on unmount
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Debouncer } from "@tanstack/pacer";

const TYPING_TIMEOUT = 3000; // Clear typing status after 3s of no typing
const DEBOUNCE_DELAY = 500; // Debounce typing events by 500ms
const POLL_INTERVAL = 2000; // Poll for typing status every 2s

// In-memory typing status store (would be Redis in production)
// Format: { conversationId: { usersTyping: { [userId]: timestamp } } }
const typingStatusStore: Record<string, Record<string, number>> = {};

interface TypingIndicatorOptions {
  conversationId: string;
  enabled?: boolean;
}

interface TypingIndicatorReturn {
  isTyping: boolean;
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;
  handleInputChange: (text: string) => void;
}

/**
 * Hook to manage typing indicator state
 */
export function useTypingIndicator({
  conversationId,
  enabled = true,
}: TypingIndicatorOptions): TypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const user = useAuthStore((s) => s.user);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef<string>("");

  // Initialize conversation in store
  useEffect(() => {
    if (!typingStatusStore[conversationId]) {
      typingStatusStore[conversationId] = {};
    }
  }, [conversationId]);

  // Broadcast typing status
  const broadcastTyping = useCallback(
    (typing: boolean) => {
      if (!user?.id || !enabled) return;

      if (typing) {
        typingStatusStore[conversationId] = {
          ...typingStatusStore[conversationId],
          [user.id]: Date.now(),
        };
      } else {
        const { [user.id]: _, ...rest } =
          typingStatusStore[conversationId] || {};
        typingStatusStore[conversationId] = rest;
      }

      setIsTyping(typing);
    },
    [conversationId, user?.id, enabled],
  );

  // Set typing status with auto-clear
  const setTyping = useCallback(
    (typing: boolean) => {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (typing) {
        broadcastTyping(true);

        // Auto-clear after timeout
        typingTimeoutRef.current = setTimeout(() => {
          broadcastTyping(false);
        }, TYPING_TIMEOUT);
      } else {
        broadcastTyping(false);
      }
    },
    [broadcastTyping],
  );

  // Create debounced typing trigger using TanStack Pacer
  const debouncedSetTyping = useMemo(
    () =>
      new Debouncer(() => setTyping(true), {
        wait: DEBOUNCE_DELAY,
      }),
    [setTyping],
  );

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (text: string) => {
      // Only trigger if text actually changed
      if (text === lastTextRef.current) return;
      lastTextRef.current = text;

      if (text.length > 0) {
        // Debounce the typing indicator using TanStack Pacer
        debouncedSetTyping.maybeExecute();
      } else {
        // Immediately clear if text is empty
        debouncedSetTyping.cancel();
        setTyping(false);
      }
    },
    [setTyping, debouncedSetTyping],
  );

  // Poll for typing status from other users
  useEffect(() => {
    if (!enabled || !user?.id) return;

    const pollTypingStatus = () => {
      const conversationTyping = typingStatusStore[conversationId] || {};
      const now = Date.now();

      // Get users who are typing (excluding self, within timeout)
      const activeTypingUsers = Object.entries(conversationTyping)
        .filter(([userId, timestamp]) => {
          return userId !== user.id && now - timestamp < TYPING_TIMEOUT;
        })
        .map(([userId]) => userId);

      setTypingUsers(activeTypingUsers);

      // Clean up expired entries
      Object.entries(conversationTyping).forEach(([userId, timestamp]) => {
        if (now - timestamp >= TYPING_TIMEOUT) {
          delete typingStatusStore[conversationId][userId];
        }
      });
    };

    // Initial poll
    pollTypingStatus();

    // Set up polling interval
    const pollInterval = setInterval(pollTypingStatus, POLL_INTERVAL);

    return () => {
      clearInterval(pollInterval);
    };
  }, [conversationId, user?.id, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Cancel debounced typing on cleanup
      debouncedSetTyping.cancel();
      // Clear typing status when leaving conversation
      if (user?.id && typingStatusStore[conversationId]) {
        delete typingStatusStore[conversationId][user.id];
      }
    };
  }, [conversationId, user?.id, debouncedSetTyping]);

  return {
    isTyping,
    typingUsers,
    setTyping,
    handleInputChange,
  };
}

/**
 * API functions for typing indicator (for future WebSocket/server integration)
 */
export const typingIndicatorApi = {
  // Send typing status to server
  async sendTypingStatus(
    conversationId: string,
    isTyping: boolean,
  ): Promise<void> {
    try {
      // TODO: Implement WebSocket or API call for real-time typing
      // For now, using in-memory store above
      console.log(
        `[TypingIndicator] ${isTyping ? "Started" : "Stopped"} typing in ${conversationId}`,
      );
    } catch (error) {
      console.error("[TypingIndicator] Failed to send status:", error);
    }
  },

  // Subscribe to typing events (would use WebSocket in production)
  subscribeToTyping(
    conversationId: string,
    callback: (typingUsers: string[]) => void,
  ): () => void {
    // TODO: Implement WebSocket subscription
    // For now, return no-op unsubscribe
    return () => {};
  },
};
