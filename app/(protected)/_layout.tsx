"use client";

import { Stack } from "expo-router";
import { Platform } from "react-native";

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
  return (
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
      <Stack.Screen name="events/create" options={modalTransitionConfig} />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="story/[id]" options={fullScreenModalConfig} />
      <Stack.Screen name="story/create" options={fullScreenModalConfig} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="comments" options={modalTransitionConfig} />
    </Stack>
  );
}
