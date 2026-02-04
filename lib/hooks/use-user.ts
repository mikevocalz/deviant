/**
 * User Hook
 *
 * Provides React Query hook for fetching user profile data by username
 * Uses Supabase directly
 */

import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";

export function useUser(username: string | null | undefined) {
  return useQuery({
    queryKey: ["users", "username", username],
    queryFn: () => usersApi.getProfileByUsername(username!),
    enabled: !!username,
    staleTime: 5000, // Shorter stale time to ensure fresh data after follow/unfollow
    refetchOnMount: true,
  });
}
