/**
 * React Query hooks for stories
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storiesApi as storiesApiClient } from "@/lib/api/stories";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Story } from "@/lib/types";

// Query keys
export const storyKeys = {
  all: ["stories"] as const,
  list: () => [...storyKeys.all, "list"] as const,
};

// Fetch all stories
export function useStories() {
  return useQuery({
    queryKey: storyKeys.list(),
    queryFn: () => storiesApiClient.getStories(),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });
}

// Create story mutation
export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: storiesApiClient.createStory,
    onMutate: async (newStoryData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all });

      // Get current user for optimistic update
      const currentUser = useAuthStore.getState().user;

      // Snapshot previous data
      const previousData = queryClient.getQueryData<Story[]>(storyKeys.list());

      // Optimistically add the new story
      // CRITICAL: For optimistic update, we use currentUser.avatar since this IS the user's own story
      // This is allowed because the story being created belongs to the current user
      // The avatar will be replaced with the server's response which comes from entity data
      queryClient.setQueryData<Story[]>(storyKeys.list(), (old) => {
        if (!old) return old;
        const optimisticStory: Story = {
          id: `temp-${Date.now()}`,
          userId: currentUser?.id || "",
          username: currentUser?.username || "You",
          avatar: currentUser?.avatar || "",
          isViewed: false,
          items: (newStoryData.items || []).map((item, index) => ({
            id: `temp-item-${index}`,
            type: item.type as "image" | "video" | "text",
            url: item.url,
            thumbnail: (item as any).thumbnail,
            text: item.text,
            textColor: item.textColor,
            backgroundColor: item.backgroundColor,
          })),
        };
        return [optimisticStory, ...old];
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(storyKeys.list(), context.previousData);
      }
    },
    onSuccess: () => {
      // CRITICAL: Invalidate to refetch from server so avatar comes from
      // entity data (author record), NOT authUser. Building a story object
      // here with currentUser.avatar would leak the user's latest profile
      // avatar into the story display — a SEV-0 data isolation violation.
      queryClient.invalidateQueries({ queryKey: storyKeys.all });
    },
  });
}

// Delete story mutation with optimistic update
export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: storiesApiClient.deleteStory,
    onMutate: async (deletedStoryId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: storyKeys.all });

      // Snapshot previous data for rollback
      const previousData = queryClient.getQueryData<Story[]>(storyKeys.list());

      // Optimistically remove from stories list
      queryClient.setQueryData<Story[]>(storyKeys.list(), (old) => {
        if (!old) return old;
        return old.filter((story) => story.id !== deletedStoryId);
      });

      return { previousData };
    },
    onError: (_err, _deletedStoryId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(storyKeys.list(), context.previousData);
      }
    },
    onSuccess: (_result, deletedStoryId) => {
      console.log(
        "[useDeleteStory] Story deleted successfully:",
        deletedStoryId,
      );
      // No need to invalidate - optimistic update already removed the story
    },
  });
}
