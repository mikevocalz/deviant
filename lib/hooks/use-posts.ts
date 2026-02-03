import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { debounce } from "@tanstack/pacer";
import { postsApi } from "@/lib/api/supabase-posts";
import type { Post } from "@/lib/types";
import { useRef, useCallback, useMemo } from "react";

// Track in-flight like mutations per post to prevent race conditions
const pendingLikeMutations = new Set<string>();

// Query keys
export const postKeys = {
  all: ["posts"] as const,
  feed: () => [...postKeys.all, "feed"] as const,
  feedInfinite: () => [...postKeys.all, "feed", "infinite"] as const,
  profilePosts: (userId: string) => ["profilePosts", userId] as const,
  profile: (userId: string) => postKeys.profilePosts(userId),
  detail: (id: string) => [...postKeys.all, "detail", id] as const,
};

// Fetch feed posts (legacy - for backwards compatibility)
export function useFeedPosts() {
  return useQuery({
    queryKey: postKeys.feed(),
    queryFn: postsApi.getFeedPosts,
  });
}

// Fetch feed posts with infinite scroll
export function useInfiniteFeedPosts() {
  return useInfiniteQuery({
    queryKey: postKeys.feedInfinite(),
    queryFn: ({ pageParam = 0 }) => postsApi.getFeedPostsPaginated(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// Fetch profile posts
export function useProfilePosts(userId: string) {
  return useQuery<Post[]>({
    queryKey: postKeys.profilePosts(userId),
    queryFn: () => postsApi.getProfilePosts(userId),
    enabled: !!userId,
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnMount: "always", // Force refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
  });
}

// Fetch single post by ID
// CRITICAL: This is the canonical query for Post Detail - always ID-driven
export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => {
      console.log("[usePost] Fetching post:", id);
      return postsApi.getPostById(id);
    },
    enabled: !!id && id.length > 0,
    staleTime: 30 * 1000, // 30 seconds - prevents aggressive refetching
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 2, // Retry failed requests twice
    refetchOnMount: true, // Always fetch fresh data when component mounts
    refetchOnWindowFocus: false, // Don't refetch on app focus (prevents flicker)
  });
}

// Fetch multiple posts by IDs
export function usePostsByIds(ids: string[]) {
  return useQuery({
    queryKey: [...postKeys.all, "byIds", ids.sort().join(",")],
    queryFn: async () => {
      const posts = await Promise.all(
        ids.map((id) => postsApi.getPostById(id)),
      );
      return posts.filter((post): post is Post => post !== null);
    },
    enabled: ids.length > 0,
  });
}

// Check if a specific post has a pending like mutation
export function isLikePending(postId: string): boolean {
  return pendingLikeMutations.has(postId);
}

/**
 * STABILIZED Like Post Mutation
 *
 * CRITICAL CHANGES:
 * 1. NO optimistic updates - wait for server confirmation
 * 2. Server response is the ONLY source of truth
 * 3. Update React Query cache with server data
 * 4. Update Zustand store with server data
 * 5. Debounce to prevent rapid taps
 */
export function useLikePost() {
  const queryClient = useQueryClient();
  const DEBOUNCE_MS = 300;

  const mutation = useMutation({
    mutationKey: ["likePost"],
    mutationFn: async ({
      postId,
      isLiked,
    }: {
      postId: string;
      isLiked: boolean;
    }) => {
      // Check if mutation is already in flight for this post
      if (pendingLikeMutations.has(postId)) {
        console.log(
          `[useLikePost] Mutation already in flight for ${postId}, skipping`,
        );
        throw new Error("DUPLICATE_MUTATION");
      }

      // Mark this post as having an in-flight mutation
      pendingLikeMutations.add(postId);

      try {
        const result = await postsApi.likePost(postId, isLiked);
        console.log(`[useLikePost] Server response:`, result);
        return result;
      } finally {
        // Always clean up the pending state
        pendingLikeMutations.delete(postId);
      }
    },
    // NO onMutate - we do NOT do optimistic updates
    onError: (err, variables) => {
      if (err.message === "DUPLICATE_MUTATION") {
        // Silently ignore duplicate mutations
        return;
      }
      console.error(
        `[useLikePost] Error liking post ${variables.postId}:`,
        err,
      );
    },
    onSuccess: (data, variables) => {
      const { postId } = variables;

      // CRITICAL: Update Zustand store with SERVER state
      import("@/lib/stores/post-store").then(({ usePostStore }) => {
        usePostStore.getState().setPostLiked(postId, data.liked);
      });

      // Update React Query cache with server data
      // Note: postsApi.likePost returns { postId, likes, liked }
      // (maps response.likesCount to likes internally)
      // Update the specific post detail
      queryClient.setQueryData<Post>(postKeys.detail(postId), (old) => {
        if (!old) return old;
        return { ...old, likes: data.likes };
      });

      // Update posts in feed cache
      queryClient.setQueriesData<Post[]>(
        { queryKey: postKeys.feed() },
        (old) => {
          if (!old) return old;
          return old.map((post) =>
            post.id === postId ? { ...post, likes: data.likes } : post,
          );
        },
      );

      // Update infinite feed cache
      queryClient.setQueryData(postKeys.feedInfinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((post: Post) =>
              post.id === postId ? { ...post, likes: data.likes } : post,
            ),
          })),
        };
      });

      // CRITICAL: Only invalidate the current user's liked posts cache
      // DO NOT use broad keys like ["users"] as this affects ALL user caches
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts"] });
    },
  });

  // Debounced mutate function
  const debouncedMutate = useMemo(
    () =>
      debounce(
        (variables: { postId: string; isLiked: boolean }) => {
          mutation.mutate(variables);
        },
        { wait: DEBOUNCE_MS },
      ),
    [mutation],
  );

  // Safe mutate that checks pending state
  const safeMutate = useCallback(
    (variables: { postId: string; isLiked: boolean }) => {
      const { postId } = variables;

      // Block if already pending
      if (pendingLikeMutations.has(postId)) {
        console.log(`[useLikePost] Blocked: mutation pending for ${postId}`);
        return;
      }

      debouncedMutate(variables);
    },
    [debouncedMutate],
  );

  return {
    ...mutation,
    mutate: safeMutate,
    isPostPending: (postId: string) => pendingLikeMutations.has(postId),
  };
}

// Sync liked posts from server to Zustand store
export function useSyncLikedPosts() {
  return useQuery({
    queryKey: ["likedPosts"],
    queryFn: async () => {
      const { usersApi } = await import("@/lib/api/supabase-users");
      const likedPosts = await usersApi.getLikedPosts();

      // Sync to Zustand store
      const { usePostStore } = await import("@/lib/stores/post-store");
      usePostStore.getState().syncLikedPosts(likedPosts);

      console.log("[useSyncLikedPosts] Synced liked posts:", likedPosts.length);
      return likedPosts;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// Create post mutation
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsApi.createPost,
    onMutate: async (newPostData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postKeys.all });

      // Snapshot previous data
      const previousData = queryClient.getQueriesData({
        queryKey: postKeys.all,
      });

      // Optimistically add the new post to infinite feed
      queryClient.setQueryData(postKeys.feedInfinite(), (old: any) => {
        if (!old || !old.pages || old.pages.length === 0) return old;
        // Add to first page
        const firstPage = old.pages[0];
        if (firstPage && firstPage.data) {
          const optimisticPost: Post = {
            id: `temp-${Date.now()}`,
            author: {
              username: "You",
              avatar: "",
              verified: false,
            },
            media: (newPostData.media || []).map((m) => ({
              ...m,
              type: m.type as "image" | "video",
            })),
            caption: newPostData.content || "",
            likes: 0,
            comments: [],
            timeAgo: "Just now",
            location: newPostData.location,
            isNSFW: newPostData.isNSFW || false,
          };
          return {
            ...old,
            pages: [
              {
                ...firstPage,
                data: [optimisticPost, ...firstPage.data],
              },
              ...old.pages.slice(1),
            ],
          };
        }
        return old;
      });

      // Also update legacy feed query if it exists
      queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
        if (!old) return old;
        const optimisticPost: Post = {
          id: `temp-${Date.now()}`,
          author: {
            username: "You",
            avatar: "",
            verified: false,
          },
          media: (newPostData.media || []).map((m) => ({
            ...m,
            type: m.type as "image" | "video",
          })),
          caption: newPostData.content || "",
          likes: 0,
          comments: [],
          timeAgo: "Just now",
          location: newPostData.location,
          isNSFW: newPostData.isNSFW || false,
        };
        return [optimisticPost, ...old];
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (newPost) => {
      console.log("[useCreatePost] Post created successfully:", newPost?.id);

      // Replace the optimistic post with the real one instead of invalidating
      // This prevents double posts from appearing
      if (newPost?.id) {
        // Update infinite feed - replace temp post with real one
        queryClient.setQueryData(postKeys.feedInfinite(), (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any, pageIndex: number) => {
              if (pageIndex === 0 && page.data) {
                // Remove temp posts and add real post at the beginning
                const filteredData = page.data.filter(
                  (p: Post) => !p.id.startsWith("temp-"),
                );
                return {
                  ...page,
                  data: [newPost, ...filteredData],
                };
              }
              return page;
            }),
          };
        });

        // Update legacy feed
        queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
          if (!old) return old;
          const filteredData = old.filter((p) => !p.id.startsWith("temp-"));
          return [newPost, ...filteredData];
        });
      }
    },
  });
}

// Update post mutation
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      updates,
    }: {
      postId: string;
      updates: { content?: string; location?: string };
    }) => postsApi.updatePost(postId, updates),
    onSuccess: (updatedPost, { postId }) => {
      // Update the specific post in cache
      if (updatedPost) {
        queryClient.setQueryData<Post>(postKeys.detail(postId), updatedPost);
      }
      // Invalidate feed to show updated content
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      queryClient.invalidateQueries({ queryKey: postKeys.feedInfinite() });
    },
  });
}

// Delete post mutation with optimistic update
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsApi.deletePost,
    onMutate: async (deletedPostId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postKeys.all });

      // Snapshot previous data for rollback
      const previousInfinite = queryClient.getQueryData(
        postKeys.feedInfinite(),
      );
      const previousFeed = queryClient.getQueryData(postKeys.feed());

      // Optimistically remove from infinite feed
      queryClient.setQueryData(postKeys.feedInfinite(), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.filter((post: Post) => post.id !== deletedPostId),
          })),
        };
      });

      // Optimistically remove from legacy feed
      queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
        if (!old) return old;
        return old.filter((post) => post.id !== deletedPostId);
      });

      // Optimistically remove from profile posts (all users)
      queryClient.setQueriesData<Post[]>(
        { queryKey: ["profilePosts"] },
        (old) => {
          if (!old) return old;
          return old.filter((post) => post.id !== deletedPostId);
        },
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: postKeys.detail(deletedPostId) });

      return { previousInfinite, previousFeed };
    },
    onError: (_err, _deletedPostId, context) => {
      // Rollback on error
      if (context?.previousInfinite) {
        queryClient.setQueryData(
          postKeys.feedInfinite(),
          context.previousInfinite,
        );
      }
      if (context?.previousFeed) {
        queryClient.setQueryData(postKeys.feed(), context.previousFeed);
      }
    },
    onSuccess: (_result, deletedPostId) => {
      console.log("[useDeletePost] Post deleted successfully:", deletedPostId);
      // No need to invalidate - optimistic update already removed the post
    },
  });
}
