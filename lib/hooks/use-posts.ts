import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { postsApi } from "@/lib/api/supabase-posts";
import type { Post } from "@/lib/types";

// Query keys
export const postKeys = {
  all: ["posts"] as const,
  feed: () => [...postKeys.all, "feed"] as const,
  feedInfinite: () => [...postKeys.all, "feed", "infinite"] as const,
  profile: (username: string) =>
    [...postKeys.all, "profile", username] as const,
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
  return useQuery({
    queryKey: postKeys.profile(userId),
    queryFn: () => postsApi.getProfilePosts(userId),
    enabled: !!userId,
  });
}

// Fetch single post
export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => postsApi.getPostById(id),
    enabled: !!id,
  });
}

// Fetch multiple posts by IDs
export function usePostsByIds(ids: string[]) {
  return useQuery({
    queryKey: [...postKeys.all, "byIds", ids.sort().join(",")],
    queryFn: async () => {
      const posts = await Promise.all(
        ids.map((id) => postsApi.getPostById(id))
      );
      return posts.filter((post): post is Post => post !== null);
    },
    enabled: ids.length > 0,
  });
}

// Like/unlike post mutation
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      postsApi.likePost(postId, isLiked),
    onMutate: async ({ postId, isLiked }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postKeys.all });

      // Optimistically update all post caches
      const previousData = queryClient.getQueriesData({
        queryKey: postKeys.all,
      });

      // Update React Query cache optimistically
      queryClient.setQueriesData<Post[] | Post | null>(
        { queryKey: postKeys.all },
        (old) => {
          const delta = isLiked ? -1 : 1;
          if (Array.isArray(old)) {
            return old.map((post) =>
              post.id === postId
                ? { ...post, likes: Math.max(0, post.likes + delta) }
                : post,
            );
          }
          if (
            old &&
            typeof old === "object" &&
            "id" in old &&
            old.id === postId
          ) {
            return { ...old, likes: Math.max(0, old.likes + delta) };
          }
          return old;
        },
      );

      // Also update Zustand store optimistically for instant UI updates
      const { usePostStore } = await import("@/lib/stores/post-store");
      const store = usePostStore.getState();
      const currentCount = store.getLikeCount(postId, 0);
      const delta = isLiked ? -1 : 1;
      usePostStore.setState({
        postLikeCounts: {
          ...store.postLikeCounts,
          [postId]: Math.max(0, currentCount + delta),
        },
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
    onSuccess: (data) => {
      // Invalidate user data to sync liked posts
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
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
      queryClient.setQueryData(
        postKeys.feedInfinite(),
        (old: any) => {
          if (!old || !old.pages || old.pages.length === 0) return old;
          // Add to first page
          const firstPage = old.pages[0];
          if (firstPage && firstPage.data) {
            const optimisticPost: Post = {
              id: `temp-${Date.now()}`,
              author: {
                username: newPostData.authorUsername || "You",
                avatar: "",
                verified: false,
              },
              media: (newPostData.media || []) as Array<{ type: "image" | "video"; url: string }>,
              caption: newPostData.caption || "",
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
        },
      );

      // Also update legacy feed query if it exists
      queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
        if (!old) return old;
        const optimisticPost: Post = {
          id: `temp-${Date.now()}`,
          author: {
            username: newPostData.authorUsername || "You",
            avatar: "",
            verified: false,
          },
          media: (newPostData.media || []) as Array<{ type: "image" | "video"; url: string }>,
          caption: newPostData.caption || "",
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
      console.log("[useCreatePost] Post created successfully:", newPost.id);
      // Invalidate to get real data with correct ID
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}

// Delete post mutation
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsApi.deletePost,
    onSuccess: (deletedPostId) => {
      // Remove deleted post from all caches
      queryClient.setQueriesData<Post[] | Post | null>(
        { queryKey: postKeys.all },
        (old) => {
          if (Array.isArray(old)) {
            return old.filter((post) => post.id !== deletedPostId);
          }
          return old;
        },
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}
