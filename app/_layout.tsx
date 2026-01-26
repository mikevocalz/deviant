"use client";

import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AnimatedSplashScreen from "@/components/animated-splash-screen";
import Animated, { FadeIn, Easing } from "react-native-reanimated";
import { PortalHost } from "@rn-primitives/portal";
import { ThemeProvider } from "@react-navigation/native";
import { Toaster } from "sonner-native";
import { NAV_THEME } from "@/theme";
import { useColorScheme } from "@/lib/hooks";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useUpdates } from "@/lib/hooks/use-updates";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { setQueryClient } from "@/lib/auth-client";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Register query client with auth module so it can clear cache on user switch
setQueryClient(queryClient);

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const { loadAuthState, isAuthenticated, hasSeenOnboarding } = useAuthStore();
  const {
    appReady,
    splashAnimationFinished,
    setAppReady,
    onAnimationFinish,
    setSplashAnimationFinished,
  } = useAppStore();
  const insets = useSafeAreaInsets();

  // NOTE: We do NOT reset splashAnimationFinished here.
  // Once the splash animation is finished, it should never replay during the app session.
  // The splashAnimationFinished state is initialized to false in the store,
  // and is set to true when the animation completes via onAnimationFinish.

  // Check for OTA updates on app launch and foreground
  useUpdates();

  // Initialize push notifications
  useNotifications();

  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
    "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
    "Republica-Minor": require("../assets/fonts/Republica-Minor.ttf"),
  });

  useEffect(() => {
    // Health check to verify network connectivity to API
    const checkAPIHealth = async () => {
      const API_URL =
        process.env.EXPO_PUBLIC_AUTH_URL ||
        "https://server-zeta-lovat.vercel.app";
      console.log("[RootLayout] Checking API health at:", API_URL);
      try {
        const res = await fetch(`${API_URL}/api/users?limit=1`);
        console.log("[RootLayout] API Health OK - Status:", res.status);
      } catch (err) {
        console.error("[RootLayout] API Health FAIL:", err);
      }
    };
    checkAPIHealth();

    // Load auth state and attempt recovery if needed
    const initAuth = async () => {
      await loadAuthState();
      // Small delay to let persist rehydrate, then check if we need recovery
      setTimeout(async () => {
        const { user, isAuthenticated } = useAuthStore.getState();
        if (!user && !isAuthenticated) {
          console.log("[RootLayout] No user in store, attempting recovery...");
          await loadAuthState(); // Try recovery
        }
      }, 500);
    };
    initAuth();
  }, [loadAuthState]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppReady(true);
    }
  }, [fontsLoaded, fontError, setAppReady]);

  // Hide native splash as soon as app is ready so the Rive animated splash is visible.
  // If we waited until splashAnimationFinished, the native splash would stay on top
  // and cover the Rive animation the entire time.
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  // Show animated splash until BOTH app is ready AND animation is finished
  // IMPORTANT: Always wait for splashAnimationFinished, even if appReady is true
  const showAnimatedSplash = !splashAnimationFinished;

  console.log("[RootLayout] Splash state:", {
    appReady,
    splashAnimationFinished,
    showAnimatedSplash,
  });

  if (showAnimatedSplash) {
    return <AnimatedSplashScreen onAnimationFinish={onAnimationFinish} />;
  }

  console.log("[RootLayout] Showing main app");

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        height: "100%",
        width: "100%",
        backgroundColor: "#000",
      }}
    >
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={NAV_THEME[colorScheme]}>
            <Animated.View
              style={{
                flex: 1,
                paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
              }}
              entering={FadeIn.duration(800).easing(Easing.out(Easing.cubic))}
            >
              <StatusBar backgroundColor="#000" style="light" animated />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  animationDuration: 200,
                  contentStyle: { backgroundColor: "#8a40cf" },
                }}
              >
                <Stack.Protected guard={!isAuthenticated}>
                  <Stack.Screen name="(auth)" options={{ animation: "none" }} />
                </Stack.Protected>
                <Stack.Protected guard={isAuthenticated}>
                  <Stack.Screen
                    name="(protected)"
                    options={{ animation: "none" }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{
                      headerShown: true,
                      presentation: "fullScreenModal",
                      animation: "slide_from_bottom",
                      animationDuration: 300,
                      gestureEnabled: true,
                      gestureDirection: "vertical",
                    }}
                  />
                </Stack.Protected>
              </Stack>
            </Animated.View>
            <PortalHost />
            <Toaster
              position="top-center"
              offset={60}
              theme="dark"
              toastOptions={{
                style: {
                  backgroundColor: "#1a1a1a",
                  borderColor: "#333",
                  borderWidth: 1,
                },
                titleStyle: { color: "#fff" },
                descriptionStyle: { color: "#a1a1aa" },
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
