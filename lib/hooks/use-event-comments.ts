/**
 * Event Comments Hooks
 *
 * React Query hooks for event comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

export const eventCommentKeys = {
  all: ["event-comments"] as const,
  event: (eventId: string) => [...eventCommentKeys.all, "event", eventId] as const,
};

// Fetch comments for an event (uses custom endpoint)
export function useEventComments(eventId: string, limit: number = 10) {
  return useQuery({
    queryKey: eventCommentKeys.event(eventId),
    queryFn: async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) return [];

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events/${eventId}/comments?limit=${limit}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        console.error("[useEventComments] Fetch failed:", response.status);
        return [];
      }

      const result = await response.json();
      return result.docs || [];
    },
    enabled: !!eventId,
  });
}

// Create comment mutation (uses custom endpoint)
export function useCreateEventComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      text: string;
      parent?: string;
      authorUsername?: string;
    }) => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("API URL not configured");

      const token = await getAuthToken();

      const response = await fetch(
        `${apiUrl}/api/events/${data.eventId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: data.text,
            parent: data.parent || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create comment: ${response.status}`);
      }

      return await response.json();
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventCommentKeys.event(variables.eventId),
      });

      // Snapshot previous data
      const previousComments = queryClient.getQueryData(
        eventCommentKeys.event(variables.eventId),
      );

      // Optimistically add the new comment
      queryClient.setQueryData(
        eventCommentKeys.event(variables.eventId),
        (old: any[]) => {
          if (!old) return old;
          const optimisticComment = {
            id: `temp-${Date.now()}`,
            text: variables.text,
            authorUsername: variables.authorUsername || "You",
            createdAt: new Date().toISOString(),
            parent: variables.parent,
          };
          return [...old, optimisticComment];
        },
      );

      return { previousComments };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(
          eventCommentKeys.event(variables.eventId),
          context.previousComments,
        );
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to get real data with correct ID
      queryClient.invalidateQueries({
        queryKey: eventCommentKeys.event(variables.eventId),
      });
    },
  });
}
