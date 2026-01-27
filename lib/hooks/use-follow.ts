/**
 * STABILIZED Follow/Unfollow Hook
 *
 * PHASE 0: Optimistic updates DISABLED during stabilization
 *
 * CRITICAL CHANGES:
 * 1. NO optimistic updates - wait for server confirmation
 * 2. Server response is the ONLY source of truth
 * 3. Invalidate queries to refresh from server
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { users } from "@/lib/api-client";
import { useUIStore } from "@/lib/stores/ui-store";

export function useFollow() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  return useMutation({
    mutationFn: async ({
      userId,
      action,
    }: {
      userId: string;
      action: "follow" | "unfollow";
    }) => {
      return await users.follow(userId, action);
    },
    // NO onMutate - STABILIZED: no optimistic updates during Phase 0
    // Server response is the ONLY source of truth
    onError: (error: any) => {
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        "Failed to update follow status";
      showToast("error", "Error", errorMessage);
    },
    onSuccess: (data) => {
      showToast(
        "success",
        data.following ? "Following" : "Unfollowed",
        data.message,
      );
      // Invalidate to sync with server - this will refetch user data
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
