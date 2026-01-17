import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { postsApi } from "@/lib/api/posts";
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
export function useProfilePosts(username: string) {
  return useQuery({
    queryKey: postKeys.profile(username),
    queryFn: () => postsApi.getProfilePosts(username),
  });
}

// Fetch single post
export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => postsApi.getPostById(id),
  });
}

// Like post mutation
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsApi.likePost,
    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postKeys.all });

      // Optimistically update all post caches
      const previousData = queryClient.getQueriesData({
        queryKey: postKeys.all,
      });

      queryClient.setQueriesData<Post[] | Post | null>(
        { queryKey: postKeys.all },
        (old) => {
          if (Array.isArray(old)) {
            return old.map((post) =>
              post.id === postId ? { ...post, likes: post.likes + 1 } : post,
            );
          }
          if (
            old &&
            typeof old === "object" &&
            "id" in old &&
            old.id === postId
          ) {
            return { ...old, likes: old.likes + 1 };
          }
          return old;
        },
      );

      return { previousData };
    },
    onError: (_err, _postId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}

// Create post mutation
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsApi.createPost,
    onSuccess: (newPost) => {
      // Add new post to feed cache
      queryClient.setQueryData<Post[]>(postKeys.feed(), (old) => {
        return old ? [newPost, ...old] : [newPost];
      });
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: postKeys.feed() });
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
