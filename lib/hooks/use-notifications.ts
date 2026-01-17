/**
 * Push Notifications Hook
 *
 * Handles push notification registration and listeners
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  registerForPushNotificationsAsync,
  savePushTokenToBackend,
} from "@/lib/notifications";

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const registerPushNotifications = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();

    if (token) {
      setExpoPushToken(token);

      // Save token to backend if user is authenticated
      if (isAuthenticated && user?.id) {
        await savePushTokenToBackend(token, user.id);
      }
    }

    return token;
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    // Register for push notifications
    registerPushNotifications();

    // Listen for incoming notifications (app in foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("[Notifications] Received:", notification);
        setNotification(notification);
      });

    // Listen for notification responses (user tapped notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("[Notifications] Response:", response);
        const data = response.notification.request.content.data;

        // Handle navigation based on notification data
        if (data?.type) {
          switch (data.type) {
            case "message":
              if (data.conversationId) {
                router.push(
                  `/(protected)/messages/${data.conversationId}` as any,
                );
              }
              break;
            case "like":
            case "comment":
              if (data.postId) {
                router.push(`/(protected)/post/${data.postId}` as any);
              }
              break;
            case "follow":
              if (data.userId) {
                router.push(`/(protected)/profile/${data.userId}` as any);
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
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [registerPushNotifications, router]);

  // Re-register when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.id && expoPushToken) {
      savePushTokenToBackend(expoPushToken, user.id);
    }
  }, [isAuthenticated, user?.id, expoPushToken]);

  return {
    expoPushToken,
    notification,
    registerPushNotifications,
  };
}
