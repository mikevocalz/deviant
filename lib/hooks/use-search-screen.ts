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
import { useAppStore } from "@/lib/stores/app-store";
import {
  filterEntitiesByBoundary,
  getContentBoundaryMode,
} from "@/lib/content/spicy-boundary";

const SEARCH_QUERY_VERSION = "v2";

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
  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const contentBoundary = getContentBoundaryMode(nsfwEnabled);

  return useQuery<DiscoverDTO>({
    queryKey: ["search", SEARCH_QUERY_VERSION, "discover", contentBoundary],
    queryFn: async () => {
      const [users, posts] = await Promise.all([
        usersApi.getNewestUsers(15),
        postsApi.getExplorePosts(40),
      ]);
      return { users, posts: filterEntitiesByBoundary(posts, contentBoundary) };
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
  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const contentBoundary = getContentBoundaryMode(nsfwEnabled);

  return useQuery<SearchResultsDTO>({
    queryKey: [
      "search",
      SEARCH_QUERY_VERSION,
      "results",
      contentBoundary,
      debouncedQuery,
    ],
    queryFn: async () => {
      const isHashtag = debouncedQuery.startsWith("#");
      const [posts, users] = await Promise.all([
        searchApi.searchPosts(debouncedQuery, 50, {
          includeNsfw: contentBoundary === "spicy",
        }),
        isHashtag
          ? Promise.resolve({ docs: [], totalDocs: 0 })
          : searchApi.searchUsers(debouncedQuery, 20),
      ]);
      const visiblePosts = filterEntitiesByBoundary(
        posts.docs as Post[],
        contentBoundary,
      );
      return {
        posts: {
          ...posts,
          docs: visiblePosts,
          totalDocs: visiblePosts.length,
        },
        users,
        isHashtag,
      };
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
  });
}
