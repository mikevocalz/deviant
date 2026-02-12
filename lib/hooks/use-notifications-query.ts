/**
 * Notifications Query Hook - TanStack Query
 * Query Key: ['notifications', viewerId]
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import { useAuthStore } from "@/lib/stores/auth-store";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (viewerId: string) => ["notifications", viewerId] as const,
  badges: (viewerId: string) => ["badges", viewerId] as const,
};

export function useNotificationsQuery() {
  const viewerId = useAuthStore((s) => s.user?.id) || "";

  return useQuery({
    queryKey: notificationKeys.list(viewerId),
    queryFn: async () => {
      const response = await notificationsApi.get({ limit: 50 });
      return response.docs || [];
    },
    enabled: !!viewerId,
    // Inherits global staleTime (5min) + refetchOnMount: false
    // Boot prefetch primes this cache
  });
}

export function useBadges() {
  const viewerId = useAuthStore((s) => s.user?.id) || "";

  return useQuery({
    queryKey: notificationKeys.badges(viewerId),
    queryFn: () => notificationsApi.getBadges(),
    enabled: !!viewerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
