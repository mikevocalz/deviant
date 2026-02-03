/**
 * Search Hook
 *
 * Provides React Query hooks for searching posts and users
 * Uses Supabase directly
 */

import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api/supabase-search";

export function useSearchPosts(query: string) {
  return useQuery({
    queryKey: ["search", "posts", query],
    queryFn: () => searchApi.searchPosts(query),
    enabled: !!query && query.length >= 1,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["search", "users", query],
    queryFn: () => searchApi.searchUsers(query, 20),
    enabled: !!query && query.length >= 1,
  });
}
