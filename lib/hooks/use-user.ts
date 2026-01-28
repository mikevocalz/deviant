/**
 * User Hook
 *
 * Provides React Query hook for fetching user profile data by username
 * Uses the /api/users/:id/profile endpoint which returns computed counts
 */

import { useQuery } from "@tanstack/react-query";
import { users } from "@/lib/api-client";

export function useUser(username: string | null | undefined) {
  return useQuery({
    queryKey: ["users", "username", username],
    queryFn: async () => {
      if (!username) return null;

      // First find the user by username to get their ID
      const user = await users.findByUsername(username, 1);
      if (!user || !user.id) return null;

      // Then fetch their full profile with computed counts (followersCount, etc)
      try {
        const profile = await users.getProfile(String(user.id));
        // Merge basic user data with profile data
        return {
          ...user,
          ...profile,
          // Ensure we have the username from the original query
          username: user.username || profile.username,
        };
      } catch (profileError) {
        console.warn(
          "[useUser] Profile fetch failed, using basic user data:",
          profileError,
        );
        // Fall back to basic user data if profile endpoint fails
        return user;
      }
    },
    enabled: !!username,
    staleTime: 5000, // Shorter stale time to ensure fresh data after follow/unfollow
    refetchOnMount: true,
  });
}
