"use client";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useCallKeepCoordinator } from "@/src/services/callkeep";
import { NotificationListener } from "@/src/services/callkeep/NotificationListener";
import { usePresenceManager } from "@/lib/hooks/use-presence";
import {
  registerForPushNotificationsAsync,
  savePushTokenToBackend,
} from "@/lib/notifications";
import {
  registerVoipPushToken,
  saveVoipTokenToBackend,
} from "@/src/services/callkeep/voipPushService";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useBootPrefetch } from "@/lib/hooks/use-boot-prefetch";

const screenTransitionConfig = Platform.select({
  ios: {
    animation: "slide_from_right" as const,
    animationDuration: 250,
    gestureEnabled: true,
    gestureDirection: "horizontal" as const,
  },
  android: {
    animation: "fade_from_bottom" as const,
    animationDuration: 200,
  },
  default: {
    animation: "fade" as const,
    animationDuration: 200,
  },
});

const modalTransitionConfig = {
  presentation: "modal" as const,
  animation: "slide_from_bottom" as const,
  animationDuration: 300,
  gestureEnabled: true,
  gestureDirection: "vertical" as const,
};

const fullScreenModalConfig = {
  presentation: "fullScreenModal" as const,
  animation: "fade" as const,
  animationDuration: 250,
};

export default function ProtectedLayout() {
  // ── Boot Prefetch: warm all critical caches in parallel ──────────────
  useBootPrefetch();
  // Initialize CallKeep native call UI — registers listeners ONCE
  useCallKeepCoordinator();
  // Track current user's online/offline presence
  usePresenceManager();

  const user = useAuthStore((s) => s.user);

  // ── Register for push notifications on mount ────────────────────────
  // CRITICAL: This enables incoming calls to ring when app is backgrounded/killed
  useEffect(() => {
    if (!user?.id) return;

    const registerPush = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          console.log("[ProtectedLayout] Push token registered:", token);
          await savePushTokenToBackend(token, user.id, user.username);
          console.log("[ProtectedLayout] Push token saved to backend");
        }
      } catch (error) {
        console.error("[ProtectedLayout] Push registration failed:", error);
      }
    };

    registerPush();

    // Register for iOS VoIP push tokens (separate from Expo push)
    // This enables the native CallKit UI when app is killed
    const unsubVoip = registerVoipPushToken(async (voipToken) => {
      try {
        await saveVoipTokenToBackend(voipToken, user.id);
        console.log("[ProtectedLayout] VoIP token saved to backend");
      } catch (error) {
        console.error("[ProtectedLayout] VoIP token save failed:", error);
      }
    });

    return () => {
      unsubVoip();
    };
  }, [user?.id, user?.username]);

  return (
    <>
      {/* CRITICAL: NotificationListener handles incoming call push notifications */}
      <NotificationListener />
      <Stack
        screenOptions={{
          headerShown: false,
          ...screenTransitionConfig,
          contentStyle: { backgroundColor: "#000" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="messages/new" options={modalTransitionConfig} />
        <Stack.Screen
          name="messages/new-group"
          options={modalTransitionConfig}
        />
        <Stack.Screen
          name="post/[id]"
          options={{
            animation: "fade",
            animationDuration: 300,
            animationTypeForReplace: "push",
          }}
        />
        <Stack.Screen
          name="profile/[username]"
          options={{
            animation: "slide_from_right",
            animationDuration: 250,
          }}
        />
        <Stack.Screen name="profile/edit" options={modalTransitionConfig} />
        <Stack.Screen
          name="events/create"
          options={{ ...fullScreenModalConfig, headerShown: true }}
        />
        <Stack.Screen
          name="events/[id]"
          options={{
            animation: "fade",
            animationDuration: 300,
          }}
        />
        <Stack.Screen name="story/[id]" options={fullScreenModalConfig} />
        <Stack.Screen
          name="story/create"
          options={{ ...fullScreenModalConfig, headerShown: true }}
        />
        <Stack.Screen name="chat" />
        <Stack.Screen
          name="call/[roomId]"
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
        <Stack.Screen
          name="comments"
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="camera"
          options={{ ...fullScreenModalConfig, animation: "fade" }}
        />
      </Stack>
    </>
  );
}
