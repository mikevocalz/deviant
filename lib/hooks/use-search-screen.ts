/**
 * Search Screen Hooks — ZERO WATERFALL
 *
 * Two consolidated queries (one for discover, one for search results).
 * Each fetches ALL section data in a single Promise.all → no trickle-in.
 *
 * Rules:
 * - ONE query per screen mode (discover vs search)
 * - Skeleton until query resolves → all sections render together
 * - Debounced search query in queryKey
 * - keepPreviousData only after first success
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import { postsApi } from "@/lib/api/posts";
import { searchApi } from "@/lib/api/search";
import type { Post } from "@/lib/types";

// ── Discover mode (empty query) — single batch ─────────────────────
export interface DiscoverDTO {
  users: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    verified: boolean;
    bio: string;
    postsCount: number;
  }[];
  posts: Post[];
}

export function useDiscoverData() {
  return useQuery<DiscoverDTO>({
    queryKey: ["search", "discover"],
    queryFn: async () => {
      const [users, posts] = await Promise.all([
        usersApi.getNewestUsers(15),
        postsApi.getExplorePosts(40),
      ]);
      return { users, posts };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Search mode (has query) — single batch ──────────────────────────
export interface SearchResultsDTO {
  posts: { docs: any[]; totalDocs: number };
  users: { docs: any[]; totalDocs: number };
  isHashtag: boolean;
}

export function useSearchResults(debouncedQuery: string) {
  return useQuery<SearchResultsDTO>({
    queryKey: ["search", "results", debouncedQuery],
    queryFn: async () => {
      const isHashtag = debouncedQuery.startsWith("#");
      const [posts, users] = await Promise.all([
        searchApi.searchPosts(debouncedQuery),
        isHashtag
          ? Promise.resolve({ docs: [], totalDocs: 0 })
          : searchApi.searchUsers(debouncedQuery, 20),
      ]);
      return { posts, users, isHashtag };
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
  });
}
