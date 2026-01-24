/**
 * User Hook
 * 
 * Provides React Query hook for fetching user data by username
 */

import { useQuery } from "@tanstack/react-query";
import { users } from "@/lib/api-client";

export function useUser(username: string | null | undefined) {
  return useQuery({
    queryKey: ["users", "username", username],
    queryFn: async () => {
      if (!username) return null;
      return await users.findByUsername(username, 2);
    },
    enabled: !!username,
  });
}
