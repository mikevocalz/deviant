/**
 * React Query hooks for fetching real data from Payload CMS
 *
 * Usage:
 * const { data, isLoading } = usePosts({ limit: 10 })
 * const { data, isLoading } = useEvents({ category: 'music' })
 * const { data, isLoading } = useStories()
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  posts,
  events,
  stories,
  comments,
  users,
  type PaginatedResponse,
  type FindParams,
} from "@/lib/api-client";

// Types
export interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    name?: string;
    avatar?: string;
    verified?: boolean;
  };
  media: Array<{ type: "image" | "video"; url: string }>;
  caption?: string;
  likes: number;
  commentsCount?: number;
  location?: string;
  createdAt: string;
  isNSFW?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location?: string;
  price?: number;
  image?: string;
  category?: string;
  attendees?: Array<{ id: string; name: string; avatar?: string }>;
  totalAttendees?: number;
  likes?: number;
  organizer?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export interface Story {
  id: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
    verified?: boolean;
  };
  items: Array<{
    id: string;
    type: "image" | "video";
    url: string;
    duration?: number;
  }>;
  viewed?: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  text: string;
  likes: number;
  createdAt: string;
  replies?: Comment[];
}

// Query keys
export const queryKeys = {
  posts: (params?: FindParams) => ["posts", params] as const,
  post: (id: string) => ["posts", id] as const,
  events: (params?: FindParams & { category?: string }) =>
    ["events", params] as const,
  event: (id: string) => ["events", id] as const,
  stories: (params?: FindParams) => ["stories", params] as const,
  comments: (postId: string, params?: FindParams) =>
    ["comments", postId, params] as const,
  userPosts: (userId: string, params?: FindParams) =>
    ["userPosts", userId, params] as const,
};

// Posts hooks
export function usePosts(params: FindParams = {}) {
  return useQuery({
    queryKey: queryKeys.posts(params),
    queryFn: () => posts.find<Post>(params),
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => posts.findByID<Post>(id, 2),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Post>) =>
      posts.create<Post>(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

// Events hooks
export function useEvents(params: FindParams & { category?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.events(params),
    queryFn: () => events.find<Event>(params),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.event(id),
    queryFn: () => events.findByID<Event>(id, 2),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Event>) =>
      events.create<Event>(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

// Stories hooks
export function useStories(params: FindParams = {}) {
  return useQuery({
    queryKey: queryKeys.stories(params),
    queryFn: () => stories.find<Story>(params),
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Story>) =>
      stories.create<Story>(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
  });
}

// Comments hooks
export function useComments(postId: string, params: FindParams = {}) {
  return useQuery({
    queryKey: queryKeys.comments(postId, params),
    queryFn: () => comments.findByPost<Comment>(postId, params),
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { post: string; text: string; parent?: string }) =>
      comments.create<Comment>(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.post] });
    },
  });
}

// User posts hook (for profile)
export function useUserPosts(userId: string, params: FindParams = {}) {
  return useQuery({
    queryKey: queryKeys.userPosts(userId, params),
    queryFn: () =>
      posts.find<Post>({
        ...params,
        where: { author: { equals: userId } },
      }),
    enabled: !!userId,
  });
}

// Infinite scroll support
export function useInfinitePosts(params: FindParams = {}) {
  return useQuery({
    queryKey: ["posts", "infinite", params],
    queryFn: () => posts.find<Post>(params),
  });
}
