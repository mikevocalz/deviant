/**
 * Push Notification Service
 *
 * Handles Expo push notification registration and management
 */

import { Platform } from "react-native";

// Dynamically import expo-notifications to avoid native module errors in dev client
let Notifications: typeof import("expo-notifications") | null = null;
let Device: typeof import("expo-device") | null = null;
let Constants: typeof import("expo-constants").default | null = null;

// Only load native modules on native platforms
if (Platform.OS !== "web") {
  try {
    Notifications = require("expo-notifications");
    Device = require("expo-device");
    Constants = require("expo-constants").default;

    // Configure notification handler
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log("[Notifications] Native modules not available");
  }
}

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: unknown | null;
}

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  // Skip on web platform
  if (Platform.OS === "web") {
    console.log("[Notifications] Push notifications not supported on web");
    return null;
  }

  let token: string | null = null;

  // Must be a physical device
  if (!Device?.isDevice) {
    console.log(
      "[Notifications] Must use physical device for push notifications",
    );
    return null;
  }

  if (!Notifications) {
    console.log("[Notifications] Native module not available");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission not granted");
    return null;
  }

  try {
    // Get the project ID from app config
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.error("[Notifications] No project ID found in app config");
      return null;
    }

    // Get the Expo push token
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushTokenData.data;
    console.log("[Notifications] Push token:", token);
  } catch (error: any) {
    // Handle Firebase initialization errors gracefully
    // This can happen on Android if Firebase isn't configured, but Expo push notifications
    // will still work via Expo's service
    if (
      error?.message?.includes("FirebaseApp") ||
      error?.code === "E_REGISTRATION_FAILED"
    ) {
      console.log(
        "[Notifications] Firebase not initialized - using Expo push service only",
      );
      // Try to continue without FCM - Expo push notifications will still work
      return null;
    }
    console.error("[Notifications] Error getting push token:", error);
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B6B",
    });
  }

  return token;
}

/**
 * Send push token to Supabase for storage
 */
export async function savePushTokenToBackend(
  token: string,
  userId: string,
  username?: string,
): Promise<boolean> {
  try {
    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import("@/lib/supabase/client");
    const { getCurrentUserAuthId } = await import("@/lib/api/auth-helper");

    // Get the auth_id (UUID) — supabase.auth.getUser() returns null with Better Auth
    const authId = await getCurrentUserAuthId();
    if (!authId) {
      console.error("[Notifications] No authenticated user (no auth_id)");
      return false;
    }

    // Upsert the push token
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: authId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,token",
      },
    );

    if (error) {
      // If table doesn't exist yet, log but don't fail
      if (error.code === "42P01") {
        console.log("[Notifications] push_tokens table not yet created");
        return false;
      }
      throw error;
    }

    console.log("[Notifications] Push token saved to Supabase");
    return true;
  } catch (error) {
    console.error("[Notifications] Error saving push token:", error);
    return false;
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds = 1,
): Promise<string> {
  if (Platform.OS === "web" || !Notifications) return "";
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL,
      seconds,
    } as any,
  });
  return id;
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web" || !Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === "web" || !Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web" || !Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}
