/**
 * Hooks for managing user settings (notifications, privacy)
 * Uses TanStack Query for data fetching and mutations with optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userSettings } from "@/lib/api-client";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";

export interface NotificationPrefs {
  pauseAll: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  messages: boolean;
  liveVideos: boolean;
  emailNotifications: boolean;
}

export interface PrivacySettings {
  privateAccount: boolean;
  activityStatus: boolean;
  readReceipts: boolean;
  showLikes: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pauseAll: false,
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  messages: true,
  liveVideos: false,
  emailNotifications: false,
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  privateAccount: false,
  activityStatus: true,
  readReceipts: true,
  showLikes: true,
};

/**
 * Hook to fetch and manage notification preferences
 */
export function useNotificationPrefs() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: async () => {
      try {
        const response =
          await userSettings.getNotificationPrefs<NotificationPrefs>();
        return { ...DEFAULT_NOTIFICATION_PREFS, ...response };
      } catch (error) {
        // Return defaults if endpoint doesn't exist yet
        console.log("[useNotificationPrefs] Using defaults:", error);
        return DEFAULT_NOTIFICATION_PREFS;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: DEFAULT_NOTIFICATION_PREFS,
  });
}

/**
 * Hook to update notification preferences
 */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      return await userSettings.updateNotificationPrefs<NotificationPrefs>(
        prefs,
      );
    },
    onMutate: async (newPrefs) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["notification-prefs", user?.id],
      });

      // Snapshot previous value
      const previousPrefs = queryClient.getQueryData<NotificationPrefs>([
        "notification-prefs",
        user?.id,
      ]);

      // Optimistically update
      if (previousPrefs) {
        queryClient.setQueryData<NotificationPrefs>(
          ["notification-prefs", user?.id],
          {
            ...previousPrefs,
            ...newPrefs,
          },
        );
      }

      return { previousPrefs };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousPrefs) {
        queryClient.setQueryData(
          ["notification-prefs", user?.id],
          context.previousPrefs,
        );
      }
      showToast(
        "error",
        "Error",
        error?.message || "Failed to update notification settings",
      );
    },
    onSuccess: () => {
      // Silent success - no toast needed for toggles
    },
    onSettled: () => {
      // Refetch to ensure sync - use scoped key with userId
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ["notification-prefs", user.id],
        });
      }
    },
  });
}

/**
 * Hook to fetch and manage privacy settings
 */
export function usePrivacySettings() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["privacy-settings", user?.id],
    queryFn: async () => {
      try {
        const response =
          await userSettings.getPrivacySettings<PrivacySettings>();
        return { ...DEFAULT_PRIVACY_SETTINGS, ...response };
      } catch (error) {
        // Return defaults if endpoint doesn't exist yet
        console.log("[usePrivacySettings] Using defaults:", error);
        return DEFAULT_PRIVACY_SETTINGS;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: DEFAULT_PRIVACY_SETTINGS,
  });
}

/**
 * Hook to update privacy settings
 */
export function useUpdatePrivacySettings() {
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (settings: Partial<PrivacySettings>) => {
      return await userSettings.updatePrivacySettings<PrivacySettings>(
        settings,
      );
    },
    onMutate: async (newSettings) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["privacy-settings", user?.id],
      });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<PrivacySettings>([
        "privacy-settings",
        user?.id,
      ]);

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData<PrivacySettings>(
          ["privacy-settings", user?.id],
          {
            ...previousSettings,
            ...newSettings,
          },
        );
      }

      return { previousSettings };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(
          ["privacy-settings", user?.id],
          context.previousSettings,
        );
      }
      showToast(
        "error",
        "Error",
        error?.message || "Failed to update privacy settings",
      );
    },
    onSuccess: () => {
      // Silent success - no toast needed for toggles
    },
    onSettled: () => {
      // Refetch to ensure sync - use scoped key with userId
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ["privacy-settings", user.id],
        });
      }
    },
  });
}
