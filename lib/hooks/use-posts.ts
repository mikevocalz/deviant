import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  QueryClient,
} from "@tanstack/react-query";
import { debounce } from "@tanstack/pacer";
import { postsApi } from "@/lib/api/posts";
import type { Post } from "@/lib/types";
import { useRef, useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { STALE_TIMES, GC_TIMES } from "@/lib/perf/stale-time-config";
import { profileKeys } from "@/lib/hooks/use-profile";
import { activityKeys } from "@/lib/hooks/use-activities-query";
import { isValidPostId } from "@/lib/validation/post-params";

// Track in-flight like mutations per post to prevent race conditions
const pendingLikeMutations = new Set<string>();

function findCachedPostSnapshot(
  queryClient: QueryClient,
  postId: string,
): Post | undefined {
  const direct = queryClient.getQueryData<Post>(postKeys.detail(postId));
  if (direct) return direct;

  const feed = queryClient.getQueryData<Post[]>(postKeys.feed());
  const feedMatch = feed?.find((post: Post) => post.id === postId);
  if (feedMatch) return feedMatch;

  const infiniteFeed = queryClient.getQueryData<any>(postKeys.feedInfinite());
  const pagedMatch = infiniteFeed?.pages
    ?.flatMap((page: any) => page?.data || [])
    ?.find((post: Post) => post.id === postId);
  if (pagedMatch) return pagedMatch;

  const profileQueries = queryClient.getQueriesData<Post[]>({
    queryKey: ["profilePosts"],
  });
  for (const [, posts] of profileQueries) {
    const match = posts?.find((post: Post) => post.id === postId);
    if (match) return match;
  }

  return undefined;
}

/**
 * Query key factory for posts
 *
 * RULES:
 * - Always use factory functions, never construct keys manually
 * - Profile posts MUST include userId for proper scoping
 * - Detail keys MUST include post ID
 * - Use feedInfinite() for infinite scroll queries
 *
 * @example
 * // ✅ Correct
 * queryKey: postKeys.detail(postId)
 * queryKey: postKeys.profilePosts(userId)
 * queryKey: postKeys.feedInfinite()
 *
 * // ❌ Wrong - never construct manually
 * queryKey: ["posts", "detail", postId]
 * queryKey: ["profilePosts", userId]
 */
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
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: STALE_TIMES.feed,
    refetchOnMount: false, // Prevent double loading on mount
    refetchOnWindowFocus: false, // Prevent refetch on app focus
  });
}

// Fetch profile posts
export function useProfilePosts(userId: string) {
  return useQuery<Post[]>({
    queryKey: postKeys.profilePosts(userId),
    queryFn: () => postsApi.getProfilePosts(userId),
    enabled: !!userId,
    staleTime: STALE_TIMES.profilePosts,
  });
}

// Fetch single post by ID
// CRITICAL: This is the canonical query for Post Detail - always ID-driven
export function usePost(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: async () => {
      if (__DEV__) console.log("[usePost] Fetching post:", id);
      const cachedSnapshot = findCachedPostSnapshot(queryClient, id);
      const fetchedPost = await postsApi.getPostById(id);
      return fetchedPost ?? cachedSnapshot ?? null;
    },
    // STRICT VALIDATION: Only enable query if ID is valid format (numeric or UUID)
    // This prevents queries with "undefined", "null", empty strings, etc.
    enabled: isValidPostId(id),
    retry: (failureCount, error: any) => {
      // Don't retry 404s (post deleted) or 403s (unauthorized)
      if (error?.status === 404 || error?.status === 403) return false;
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    placeholderData: isValidPostId(id)
      ? () => findCachedPostSnapshot(queryClient, id)
      : undefined,
    staleTime: STALE_TIMES.postDetail,
  });
}

// Fetch multiple posts by IDs
export function usePostsByIds(ids: string[]) {
  // Create stable query key regardless of input array order
  const stableQueryKey = useMemo(
    () => [...postKeys.all, "byIds", [...ids].sort().join(",")],
    [ids],
  );

  return useQuery({
    queryKey: stableQueryKey,
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
  const viewerId = useAuthStore((state) => state.user?.id) || "";
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
        if (__DEV__)
          console.log(
            `[useLikePost] Mutation already in flight for ${postId}, skipping`,
          );
        throw new Error("DUPLICATE_MUTATION");
      }

      // Mark this post as having an in-flight mutation
      pendingLikeMutations.add(postId);

      try {
        const result = await postsApi.likePost(postId, isLiked);
        if (__DEV__) console.log(`[useLikePost] Server response:`, result);
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
        return { ...old, likes: data.likes, viewerHasLiked: data.liked };
      });

      // Update posts in feed cache
      queryClient.setQueriesData<Post[]>(
        { queryKey: postKeys.feed() },
        (old) => {
          if (!old) return old;
          return old.map((post) =>
            post.id === postId
              ? { ...post, likes: data.likes, viewerHasLiked: data.liked }
              : post,
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
              post.id === postId
                ? { ...post, likes: data.likes, viewerHasLiked: data.liked }
                : post,
            ),
          })),
        };
      });

      // CRITICAL: Only invalidate the current user's liked posts cache
      // DO NOT use broad keys like ["users"] as this affects ALL user caches
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts"] });
      if (viewerId) {
        queryClient.invalidateQueries({
          queryKey: activityKeys.liked(viewerId),
        });
      }
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
        if (__DEV__)
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

// Sync liked posts from server to Zustand store AND React Query likeState cache
export function useSyncLikedPosts() {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((state) => state.user?.id) || "";

  return useQuery({
    queryKey: ["likedPosts"],
    queryFn: async () => {
      const { usersApi } = await import("@/lib/api/users");
      const likedPosts = await usersApi.getLikedPosts();

      // Sync to Zustand store
      const { usePostStore } = await import("@/lib/stores/post-store");
      usePostStore.getState().syncLikedPosts(likedPosts);

      // CRITICAL: Seed React Query likeState cache for each liked post
      // This ensures heart color is correct on initial load
      if (viewerId) {
        const { likeStateKeys } = await import("@/lib/hooks/usePostLikeState");
        for (const postId of likedPosts) {
          const key = likeStateKeys.forPost(viewerId, postId);
          const existing = queryClient.getQueryData(key) as
            | { hasLiked: boolean; likes: number }
            | undefined;
          if (existing) {
            // Update hasLiked but preserve existing likes count
            if (!existing.hasLiked) {
              queryClient.setQueryData(key, {
                ...existing,
                hasLiked: true,
              });
            }
          }
          // If no existing cache, do NOT seed with likes: 0.
          // The feed query now returns viewerHasLiked from the server,
          // so seedLikeState in feed.tsx will set the correct values.
        }
      }

      if (__DEV__)
        console.log(
          "[useSyncLikedPosts] Synced liked posts:",
          likedPosts.length,
        );
      return likedPosts;
    },
    staleTime: STALE_TIMES.likedPosts,
    gcTime: GC_TIMES.standard,
  });
}

// Create post mutation
export function useCreatePost() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

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
              type: (m.type as any) ?? "image",
            })),
            kind:
              newPostData.kind === "text"
                ? ("text" as const)
                : ("media" as const),
            textTheme: newPostData.textTheme || "graphite",
            caption: newPostData.content || "",
            likes: 0,
            comments: [],
            timeAgo: "Just now",
            location: newPostData.location,
            isNSFW: newPostData.isNSFW || false,
            type:
              newPostData.kind === "text"
                ? undefined
                : (newPostData.media?.[0]?.type as any) || "image",
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
            type: ((m.type as any) ??
              "image") as import("@/lib/types").MediaKind,
          })),
          kind:
            newPostData.kind === "text"
              ? ("text" as const)
              : ("media" as const),
          textTheme: newPostData.textTheme || "graphite",
          caption: newPostData.content || "",
          likes: 0,
          comments: [],
          timeAgo: "Just now",
          location: newPostData.location,
          isNSFW: newPostData.isNSFW || false,
          type:
            newPostData.kind === "text"
              ? undefined
              : (newPostData.media?.[0]?.type as any) || "image",
        };
        return [optimisticPost, ...old];
      });

      // Optimistically add to profile posts cache
      const userId = user?.id ? String(user.id) : null;
      if (userId) {
        queryClient.setQueryData<Post[]>(
          postKeys.profilePosts(userId),
          (old) => {
            if (!old) return old;
            const optimisticPost: Post = {
              id: `temp-${Date.now()}`,
              author: {
                id: userId,
                username: user?.username || "You",
                avatar: (user as any)?.avatar || "",
                verified: (user as any)?.verified || false,
              },
              media: (newPostData.media || []).map((m) => ({
                ...m,
                type: (m.type as any) ?? "image",
              })),
              kind:
                newPostData.kind === "text"
                  ? ("text" as const)
                  : ("media" as const),
              textTheme: newPostData.textTheme || "graphite",
              caption: newPostData.content || "",
              likes: 0,
              comments: [],
              timeAgo: "Just now",
              createdAt: new Date().toISOString(),
              location: newPostData.location,
              isNSFW: newPostData.isNSFW || false,
              type:
                newPostData.kind === "text"
                  ? undefined
                  : (newPostData.media?.[0]?.type as any) || "image",
            };
            return [optimisticPost, ...old];
          },
        );
      }

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
      if (__DEV__)
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

        // Replace temp post in profile posts cache with real post
        const userId = user?.id ? String(user.id) : null;
        if (userId) {
          queryClient.setQueryData<Post[]>(
            postKeys.profilePosts(userId),
            (old) => {
              if (!old) return old;
              const filtered = old.filter((p) => !p.id.startsWith("temp-"));
              return [newPost, ...filtered];
            },
          );
        }
        // Also invalidate to pick up any server-side changes
        queryClient.invalidateQueries({
          queryKey: ["profilePosts"],
          refetchType: "active",
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
      // Normalize to string for safe comparison (post.id may be number, deletedPostId is string)
      const idStr = String(deletedPostId);

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
            data: page.data?.filter((post: Post) => String(post.id) !== idStr),
          })),
        };
      });

      // Optimistically remove from legacy feed
      queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
        if (!old) return old;
        return old.filter((post) => String(post.id) !== idStr);
      });

      // Optimistically remove from profile posts (all users)
      queryClient.setQueriesData<Post[]>(
        { queryKey: ["profilePosts"] },
        (old) => {
          if (!old) return old;
          return old.filter((post) => String(post.id) !== idStr);
        },
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: postKeys.detail(deletedPostId) });

      // Optimistically decrement posts_count on all profile caches
      queryClient.setQueriesData({ queryKey: ["profile"] }, (old: any) => {
        if (!old || typeof old !== "object") return old;
        if (typeof old.postsCount === "number") {
          return { ...old, postsCount: Math.max(0, old.postsCount - 1) };
        }
        if (typeof old.posts_count === "number") {
          return { ...old, posts_count: Math.max(0, old.posts_count - 1) };
        }
        return old;
      });

      // Also update auth store user's postsCount
      const { user, setUser } = useAuthStore.getState();
      if (user && typeof (user as any).postsCount === "number") {
        setUser({
          ...user,
          postsCount: Math.max(0, (user as any).postsCount - 1),
        } as any);
      }

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
      if (__DEV__)
        console.log(
          "[useDeletePost] Post deleted successfully:",
          deletedPostId,
        );
      // Invalidate feeds + profile to sync server state
      queryClient.invalidateQueries({ queryKey: postKeys.feedInfinite() });
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
      // Use proper key factories for profile posts
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.profilePosts(userId),
        });
        queryClient.invalidateQueries({ queryKey: profileKeys.byId(userId) });
      }
    },
  });
}
