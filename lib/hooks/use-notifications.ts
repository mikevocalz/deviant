/**
 * Push Notifications Hook
 *
 * Handles push notification registration and listeners
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useActivityStore,
  type ActivityType,
} from "@/lib/stores/activity-store";
import { useUnreadCountsStore } from "@/lib/stores/unread-counts-store";
import { messagesApi as messagesApiClient } from "@/lib/api/messages-impl";
import {
  registerForPushNotificationsAsync,
  savePushTokenToBackend,
} from "@/lib/notifications";
import { Platform } from "react-native";

// Dynamically import expo-notifications to avoid native module errors
let Notifications: typeof import("expo-notifications") | null = null;
if (Platform.OS !== "web") {
  try {
    Notifications = require("expo-notifications");
  } catch (e) {
    console.log("[useNotifications] Native module not available");
  }
}

export function useNotifications() {
  // Skip on web platform
  const isWeb = Platform.OS === "web";
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<unknown | null>(null);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { addActivity } = useActivityStore();

  const registerPushNotifications = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();

    if (token) {
      setExpoPushToken(token);

      // Save token to backend if user is authenticated
      if (isAuthenticated && user?.id) {
        await savePushTokenToBackend(token, user.id, user.username);
      }
    }

    return token;
  }, [isAuthenticated, user?.id, user?.username]);

  useEffect(() => {
    // Skip on web platform
    if (isWeb) return;

    try {
      // Register for push notifications
      registerPushNotifications();

      if (!Notifications) return;

      // Listen for incoming notifications (app in foreground)
      notificationListener.current =
        Notifications.addNotificationReceivedListener(async (notification) => {
          console.log("[Notifications] Received:", notification);
          setNotification(notification);

          // Handle notification based on type
          try {
            const data = notification.request.content.data as Record<
              string,
              unknown
            >;
            const notificationType = data?.type as string;

            if (!notificationType) return;

            // CRITICAL: Messages are handled SEPARATELY from Activity notifications
            if (notificationType === "message") {
              // Message notification - update Messages badge, NOT Activity
              console.log(
                "[Notifications] Message received - updating Messages badge",
              );

              // Check if sender is followed (Inbox) or not (Spam)
              const senderId = data.senderId as string;
              if (senderId) {
                const followingIds = await messagesApiClient.getFollowingIds();
                const isInbox = followingIds.includes(senderId);

                if (isInbox) {
                  // Only increment Messages badge for Inbox messages
                  useUnreadCountsStore.getState().incrementMessages();
                  console.log(
                    "[Notifications] Inbox message - Messages badge incremented",
                  );
                } else {
                  // Spam message - do NOT increment badge
                  console.log(
                    "[Notifications] Spam message - badge NOT incremented",
                  );
                }
              }

              // Do NOT add to Activity store for messages (policy decision)
              return;
            }

            // Non-message notifications go to Activity feed
            const validActivityTypes: ActivityType[] = [
              "like",
              "comment",
              "follow",
              "mention",
              "event_invite",
              "event_update",
            ];
            if (validActivityTypes.includes(notificationType as ActivityType)) {
              console.log(
                "[Notifications] Activity notification - updating Activity",
              );

              const newActivity = {
                id: (data.notificationId as string) || `notif-${Date.now()}`,
                type: notificationType as ActivityType,
                user: {
                  id: data.senderId as string,
                  username: (data.senderUsername as string) || "Someone",
                  avatar: (data.senderAvatar as string) || "",
                },
                entityType: data.entityType as
                  | "post"
                  | "comment"
                  | "user"
                  | "event"
                  | undefined,
                entityId: data.entityId as string | undefined,
                post: data.postId
                  ? {
                      id: data.postId as string,
                      thumbnail: (data.postThumbnail as string) || "",
                    }
                  : undefined,
                event: data.eventId
                  ? {
                      id: data.eventId as string,
                      title: data.eventTitle as string,
                    }
                  : undefined,
                comment: (data.content as string) || undefined,
                timeAgo: "Just now",
                isRead: false,
              };
              addActivity(newActivity);
              // Activity unread count is automatically synced via addActivity
            }
          } catch (error) {
            console.error(
              "[Notifications] Error handling notification:",
              error,
            );
          }
        });

      // Listen for notification responses (user tapped notification)
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          try {
            console.log("[Notifications] Response:", response);
            const data = response.notification.request.content.data;

            // Handle navigation based on notification data
            if (data?.type) {
              switch (data.type) {
                case "message":
                  if (data.conversationId) {
                    router.push(
                      `/(protected)/chat/${data.conversationId}` as any,
                    );
                  }
                  break;
                case "like":
                case "comment":
                case "mention":
                  if (data.postId) {
                    router.push(`/(protected)/post/${data.postId}` as any);
                  }
                  break;
                case "follow":
                  if (data.userId || data.senderId) {
                    router.push(
                      `/(protected)/profile/${data.userId || data.senderId}` as any,
                    );
                  }
                  break;
                case "event":
                  if (data.eventId) {
                    router.push(`/(protected)/events/${data.eventId}` as any);
                  }
                  break;
                default:
                  console.log(
                    "[Notifications] Unknown notification type:",
                    data.type,
                  );
              }
            }
          } catch (error) {
            console.error("[Notifications] Error handling response:", error);
          }
        });

      return () => {
        try {
          if (notificationListener.current) {
            notificationListener.current.remove();
          }
          if (responseListener.current) {
            responseListener.current.remove();
          }
        } catch (error) {
          console.error("[Notifications] Error cleaning up:", error);
        }
      };
    } catch (error) {
      console.error("[Notifications] Error in useEffect:", error);
      // Don't crash the app if notifications fail
    }
  }, [isWeb, registerPushNotifications, router]);

  // Re-register when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.id && expoPushToken) {
      savePushTokenToBackend(expoPushToken, user.id, user.username);
    }
  }, [isAuthenticated, user?.id, user?.username, expoPushToken]);

  return {
    expoPushToken,
    notification,
    registerPushNotifications,
  };
}
