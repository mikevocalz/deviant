/**
 * React Query hooks for stories
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  storiesApi as storiesApiClient,
  storyViewsApi,
} from "@/lib/api/stories";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Story } from "@/lib/types";

// Query keys
export const storyKeys = {
  all: ["stories"] as const,
  list: () => [...storyKeys.all, "list"] as const,
};

export const storyViewKeys = {
  all: ["story-views"] as const,
  viewers: (storyId: string) =>
    [...storyViewKeys.all, "viewers", storyId] as const,
  count: (storyId: string) => [...storyViewKeys.all, "count", storyId] as const,
};

// Fetch all stories
export function useStories() {
  return useQuery({
    queryKey: storyKeys.list(),
    queryFn: () => storiesApiClient.getStories(),
    staleTime: 60 * 1000, // 1 min — stories are time-sensitive
    refetchInterval: 60 * 1000, // Background refresh every 60s
    // Inherits global refetchOnMount: false — no flicker on tab switch
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

// Fetch viewers for a story (only useful for own stories) — polls every 5s
export function useStoryViewers(storyId: string | undefined) {
  return useQuery({
    queryKey: storyViewKeys.viewers(storyId || ""),
    queryFn: () => storyViewsApi.getViewers(storyId!),
    enabled: !!storyId,
    staleTime: 0,
    refetchInterval: 5000,
  });
}

// Fetch viewer count for a story — polls every 5s to stay current
export function useStoryViewerCount(storyId: string | undefined) {
  return useQuery({
    queryKey: storyViewKeys.count(storyId || ""),
    queryFn: () => storyViewsApi.getViewerCount(storyId!),
    enabled: !!storyId,
    staleTime: 0,
    refetchInterval: 5000,
  });
}

// Fetch total viewer count across ALL story items for a user
export function useStoryViewerCountTotal(storyItemIds: string[]) {
  return useQuery({
    queryKey: [...storyViewKeys.all, "countTotal", ...storyItemIds],
    queryFn: async () => {
      if (!storyItemIds.length) return 0;
      // Get unique viewers across all items
      const allViewerSets = await Promise.all(
        storyItemIds.map((id) => storyViewsApi.getViewers(id)),
      );
      const uniqueUserIds = new Set<number>();
      for (const viewers of allViewerSets) {
        for (const v of viewers) {
          uniqueUserIds.add(v.userId);
        }
      }
      return uniqueUserIds.size;
    },
    enabled: storyItemIds.length > 0,
    staleTime: 0,
    refetchInterval: 5000,
  });
}

// Record a story view (fire-and-forget mutation)
export function useRecordStoryView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) => storyViewsApi.recordView(storyId),
    onSuccess: (_result, storyId) => {
      // Invalidate ALL viewer queries so the owner sees updated numbers
      // This covers per-item count, per-item viewers, AND the total aggregation
      queryClient.invalidateQueries({ queryKey: storyViewKeys.all });
    },
  });
}
