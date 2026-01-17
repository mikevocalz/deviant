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
import { NAV_THEME } from "@/theme";
import { useColorScheme } from "@/lib/hooks";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useUpdates } from "@/lib/hooks/use-updates";
import { useNotifications } from "@/lib/hooks/use-notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const { loadAuthState, isAuthenticated, hasSeenOnboarding } = useAuthStore();
  const { appReady, splashAnimationFinished, setAppReady, onAnimationFinish } =
    useAppStore();
  const insets = useSafeAreaInsets();

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
    loadAuthState();
  }, [loadAuthState]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, setAppReady]);

  const showAnimatedSplash = !appReady || !splashAnimationFinished;
  if (showAnimatedSplash) {
    return <AnimatedSplashScreen onAnimationFinish={onAnimationFinish} />;
  }

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
              entering={FadeIn.duration(600).easing(Easing.out(Easing.cubic))}
            >
              <StatusBar backgroundColor="#000" style="dark" animated />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  animationDuration: 200,
                  contentStyle: { backgroundColor: "#000" },
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
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
