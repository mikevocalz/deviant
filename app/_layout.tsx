import "../global.css";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persistOptions } from "@/lib/query-persistence";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AnimatedSplashScreen from "@/components/animated-splash-screen";
import { Motion } from "@legendapp/motion";
import { PortalHost } from "@rn-primitives/portal";
import { ThemeProvider } from "@react-navigation/native";
import { Toaster } from "sonner-native";
import { NAV_THEME } from "@/theme";
import { useColorScheme } from "@/lib/hooks";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View } from "react-native";
import { useUpdates } from "@/lib/hooks/use-updates";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { setQueryClient } from "@/lib/auth-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { enforceListPolicy } from "@/lib/guards/list-guard";
import * as ScreenOrientation from "expo-screen-orientation";
import { Dimensions } from "react-native";
import { BiometricLock } from "@/components/BiometricLock";
import { LayoutAnimationConfig } from "react-native-reanimated";
import { useShareIntentSafe as useShareIntent } from "@/lib/safe-native-modules";
import { useSpotifyShareStore } from "@/lib/spotify/spotify-share-store";
import { SpotifyShareSheet } from "@/components/share/spotify-share-sheet";
import { SafeStripeProvider as StripeProvider } from "@/lib/safe-native-modules";

// DEV-only: Enforce LegendList-only policy on app boot
enforceListPolicy();

// Device-aware screen orientation
// - Phones: Portrait only (better UX for feed scrolling)
// - Tablets (768px+): Allow landscape (like Instagram web)
const { width } = Dimensions.get("window");
const isTablet = width >= 768;
if (!isTablet) {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
} else {
  // Tablets can rotate freely
  ScreenOrientation.unlockAsync();
}

SplashScreen.preventAutoHideAsync();

// Supabase URL for health checks
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://npfjanxturvmjyevoyfo.supabase.co";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DEVIANT QUERY POLICY — Social-app-tuned QueryClient       ║
 * ║                                                              ║
 * ║  Render from cache first, revalidate silently in background. ║
 * ║  Navigation must NEVER block on network.                     ║
 * ║  See: .windsurf/workflows/no-waterfall-rules.md              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — cache is "fresh" this long
      gcTime: 30 * 60 * 1000, // 30 min — keep unused cache in memory
      refetchOnMount: false, // render from cache, never block navigation
      refetchOnWindowFocus: false, // no flicker on app resume
      refetchOnReconnect: true, // revalidate after network recovery
      retry: 1, // single retry on failure
      structuralSharing: true, // prevent unnecessary re-renders
    },
    mutations: {
      retry: 0, // mutations never auto-retry
    },
  },
});

// Register query client with auth module so it can clear cache on user switch
setQueryClient(queryClient);

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const loadAuthState = useAuthStore((s) => s.loadAuthState);
  const authStatus = useAuthStore((s) => s.authStatus);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
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

  // Check for OTA updates AFTER splash completes (not before)
  // This prevents update checks from interfering with splash animation
  // and ensures updates work correctly in production builds
  useUpdates({ enabled: splashAnimationFinished });

  // ── Share Intent — receive content from other apps ──────────────────
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const processSharedText = useSpotifyShareStore((s) => s.processSharedText);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;
    const text = shareIntent.text || shareIntent.webUrl || "";
    if (text) {
      processSharedText(text);
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, processSharedText, resetShareIntent]);

  // Initialize push notifications
  useNotifications();

  // ── Cold-start notification check ──────────────────────────────────
  // If the app was launched by tapping a notification, skip splash
  // and queue the route for navigation after auth settles.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (splashAnimationFinished) return; // Already past splash
    let Notifications: typeof import("expo-notifications") | null = null;
    try {
      Notifications = require("expo-notifications");
    } catch {
      return;
    }
    if (!Notifications) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (!data?.type) return;

      console.log("[RootLayout] Cold start from notification:", data.type);

      // Build the target route based on notification type
      let route: string | null = null;
      switch (data.type) {
        case "message":
          if (data.conversationId)
            route = `/(protected)/chat/${data.conversationId}`;
          break;
        case "call":
          // Call notifications are handled by NotificationListener,
          // but we still skip splash so the call UI shows immediately.
          if (data.roomId) route = `/(protected)/call/${data.roomId}`;
          break;
        case "like":
        case "comment":
        case "mention":
          if (data.postId) route = `/(protected)/post/${data.postId}`;
          break;
        case "follow":
          if (data.senderUsername)
            route = `/(protected)/profile/${data.senderUsername}`;
          else if (data.userId || data.senderId)
            route = `/(protected)/profile/${data.userId || data.senderId}`;
          break;
        case "event":
          if (data.eventId) route = `/(protected)/events/${data.eventId}`;
          break;
      }

      // Skip splash for ANY notification tap — user expects immediate content
      const store = useAppStore.getState();
      store.setSplashAnimationFinished(true);
      if (route) {
        store.setPendingNotificationRoute(route);
      }
      console.log(
        "[RootLayout] Splash skipped for notification:",
        data.type,
        route,
      );
    });
  }, [splashAnimationFinished]);

  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
    "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
    "Republica-Minor": require("../assets/fonts/Republica-Minor.ttf"),
    BraveGates: require("../assets/fonts/BraveGates.ttf"),
    LightBrighter: require("../assets/fonts/LightBrighter.ttf"),
    Oasis: require("../assets/fonts/oasis.ttf"),
    RedHat: require("../assets/fonts/redhat.ttf"),
  });

  // ── Auth initialization — runs ONCE on mount ──────────────────────────
  // CRITICAL: No double-call, no 500ms retry. loadAuthState sets authStatus
  // to 'loading' at the start and transitions to 'authenticated' or
  // 'unauthenticated' exactly once when it completes.
  useEffect(() => {
    // Health check (fire-and-forget, never blocks boot)
    fetch(`${SUPABASE_URL}/rest/v1/users?limit=1`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "" },
    })
      .then((res) =>
        console.log("[RootLayout] Supabase Health OK - Status:", res.status),
      )
      .catch((err) => console.error("[RootLayout] Supabase Health FAIL:", err));

    // Load auth state — single call, no retry loop
    loadAuthState();
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

  // ── BOOT GATE ─────────────────────────────────────────────────────────
  const authSettled = authStatus !== "loading";

  // ── Execute queued notification route ─────────────────────────────────
  // After splash is done + auth settled + authenticated, navigate to the
  // route that was queued from a cold-start notification tap.
  useEffect(() => {
    if (!splashAnimationFinished || !authSettled || !isAuthenticated) return;
    const route = useAppStore.getState().consumePendingNotificationRoute();
    if (route) {
      // Small delay to ensure Stack is fully mounted
      setTimeout(() => {
        console.log("[RootLayout] Executing queued notification route:", route);
        router.push(route as any);
      }, 100);
    }
  }, [splashAnimationFinished, authSettled, isAuthenticated]);

  // Show animated splash until BOTH app is ready AND animation is finished
  // IMPORTANT: Always wait for splashAnimationFinished, even if appReady is true
  const showAnimatedSplash = !splashAnimationFinished;

  if (showAnimatedSplash) {
    return (
      <LayoutAnimationConfig skipEntering skipExiting>
        <AnimatedSplashScreen onAnimationFinish={onAnimationFinish} />
      </LayoutAnimationConfig>
    );
  }

  return (
    <ErrorBoundary
      screenName="App"
      onError={(error, errorInfo) => {
        console.error("[RootLayout] Global crash caught:", error.message);
      }}
    >
      <GestureHandlerRootView
        style={{
          flex: 1,
          height: "100%",
          width: "100%",
          backgroundColor: "#000",
        }}
      >
        <LayoutAnimationConfig skipEntering skipExiting>
          <BottomSheetModalProvider>
            <KeyboardProvider>
              <StripeProvider
                publishableKey={
                  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
                }
                merchantIdentifier="merchant.com.deviant"
              >
                <PersistQueryClientProvider
                  client={queryClient}
                  persistOptions={persistOptions}
                >
                  <ThemeProvider value={NAV_THEME[colorScheme]}>
                    <View
                      style={{
                        flex: 1,
                        paddingBottom:
                          Platform.OS === "android" ? insets.bottom : 0,
                      }}
                    >
                      <StatusBar
                        backgroundColor="#000"
                        style="light"
                        animated
                      />
                      {/* CRITICAL: Stack is ALWAYS mounted — never conditionally unmount
                    the navigation tree. Unmounting destroys the NavigationContainer
                    and causes stale header references after OTA reload.
                    Stack.Protected gates handle auth routing internally. */}
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          animation: "fade",
                          animationDuration: 200,
                          contentStyle: { backgroundColor: "#000" },
                        }}
                      >
                        <Stack.Protected guard={!isAuthenticated}>
                          <Stack.Screen
                            name="(auth)"
                            options={{ animation: "none" }}
                          />
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
                      {/* BiometricLock renders ONLY after auth is settled + authenticated. */}
                      {isAuthenticated && <BiometricLock />}
                      {/* Spotify share sheet — renders when a Spotify link is received */}
                      <SpotifyShareSheet />
                      {/* Auth loading overlay — covers content but does NOT unmount navigation */}
                      {!authSettled && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "#000",
                            zIndex: 10000,
                          }}
                          pointerEvents="auto"
                        />
                      )}
                    </View>
                    <PortalHost />
                    {/* CRITICAL: pointerEvents box-none ensures toasts never block
                  touches on the navigation header underneath. Position bottom
                  to avoid header area entirely. */}
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                      }}
                      pointerEvents="box-none"
                    >
                      <Toaster
                        position="bottom-center"
                        offset={80}
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
                    </View>
                  </ThemeProvider>
                </PersistQueryClientProvider>
              </StripeProvider>
            </KeyboardProvider>
          </BottomSheetModalProvider>
        </LayoutAnimationConfig>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
