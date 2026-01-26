/**
 * React Query hooks for stories
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storiesApiClient, type Story } from "@/lib/api/stories";
import { useAuthStore } from "@/lib/stores/auth-store";

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
      const previousData = queryClient.getQueryData<Story[]>(
        storyKeys.list(),
      );

      // Optimistically add the new story
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
      // Invalidate to get real data with correct ID
      queryClient.invalidateQueries({ queryKey: storyKeys.all });
    },
  });
}

export type { Story };
