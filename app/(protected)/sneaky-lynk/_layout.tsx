/**
 * Sneaky Lynk Layout
 * Wraps Sneaky Lynk screens with FishjamProvider for real-time audio/video
 */

import React from "react";
import { Stack } from "expo-router";
import { FishjamProvider } from "@fishjam-cloud/react-native-client";
import Constants from "expo-constants";

const FISHJAM_APP_ID =
  Constants.expoConfig?.extra?.fishjamAppId ??
  process.env.EXPO_PUBLIC_FISHJAM_APP_ID ??
  "";

export default function SneakyLynkLayout() {
  return (
    <FishjamProvider fishjamId={FISHJAM_APP_ID}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "#000" },
        }}
      >
        <Stack.Screen name="create" />
        <Stack.Screen
          name="room/[id]"
          options={{
            gestureEnabled: false,
            animation: "fade",
          }}
        />
      </Stack>
    </FishjamProvider>
  );
}
