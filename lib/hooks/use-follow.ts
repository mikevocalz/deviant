/**
 * Follow/Unfollow Hook
 * 
 * Provides React Query mutation for following and unfollowing users
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
    onSuccess: (data, variables) => {
      // Invalidate user queries to refresh follower counts
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });

      showToast(
        "success",
        data.following ? "Following" : "Unfollowed",
        data.message,
      );
    },
    onError: (error: any) => {
      console.error("[useFollow] Error:", error);
      const errorMessage =
        error?.message || error?.error?.message || "Failed to update follow status";
      showToast("error", "Error", errorMessage);
    },
  });
}
