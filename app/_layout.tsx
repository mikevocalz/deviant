import "../global.css";
import "@/lib/query-focus-manager";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  persistOptions,
  checkAndClearCacheOnOTAUpdate,
} from "@/lib/query-persistence";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useEffect, useState } from "react";
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
import { useDeepLinkStore } from "@/lib/stores/deep-link-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, Pressable, Text, ActivityIndicator } from "react-native";
import { useUpdates } from "@/lib/hooks/use-updates";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { screenPrefetch } from "@/lib/prefetch";
import {
  getPostDetailCommentsRoute,
  getPostDetailRoute,
} from "@/lib/routes/post-routes";
import { setQueryClient } from "@/lib/auth-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeedSkeleton } from "@/components/skeletons";
import { enforceListPolicy } from "@/lib/guards/list-guard";
import { LikesSheetProvider } from "@/src/features/likes/LikesSheetController";
import * as ScreenOrientation from "expo-screen-orientation";
import { Dimensions } from "react-native";
import { BiometricLock } from "@/components/BiometricLock";
import { LayoutAnimationConfig } from "react-native-reanimated";
import { ShareIntentHandler } from "@/components/share-intent-handler";
import { SpotifyShareSheet } from "@/components/share/spotify-share-sheet";
import { SafeStripeProvider as StripeProvider } from "@/lib/safe-native-modules";
import {
  isSafeMode,
  markBootCompleted,
  getBootDiagnostics,
} from "@/lib/boot-guard";
import { SafeModeBanner } from "@/components/safe-mode-banner";
import { PublicGateSheet } from "@/components/access/PublicGateSheet";
import { DeviceTestBridge } from "@/components/dev/DeviceTestBridge";
import { AppTrace } from "@/lib/diagnostics/app-trace";

// CRITICAL: Check for OTA update and clear stale cache BEFORE creating QueryClient
// This prevents crashes from incompatible persisted cache after OTA updates
checkAndClearCacheOnOTAUpdate();

// DEV-only: Enforce LegendList-only policy on app boot
enforceListPolicy();

SplashScreen.preventAutoHideAsync();

// Supabase URL for health checks
const _rawLayoutUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_URL =
  typeof _rawLayoutUrl === "string" && _rawLayoutUrl.startsWith("https://")
    ? _rawLayoutUrl
    : "https://npfjanxturvmjyevoyfo.supabase.co";

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
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const userId = useAuthStore((s) => s.user?.id);
  const {
    appReady,
    splashAnimationFinished,
    setAppReady,
    onAnimationFinish,
    setSplashAnimationFinished,
  } = useAppStore();
  const insets = useSafeAreaInsets();
  const [shareIntentReady, setShareIntentReady] = useState(false);
  const openedFromShareIntent = useDeepLinkStore(
    (s) => s.openedFromShareIntent,
  );
  const pendingShareIntentRoute = useAppStore(
    (s) => s.pendingShareIntentRoute,
  );

  useEffect(() => {
    const delay = openedFromShareIntent ? 0 : 1500;
    const t = setTimeout(() => setShareIntentReady(true), delay);
    return () => clearTimeout(t);
  }, [openedFromShareIntent]);

  // NOTE: We do NOT reset splashAnimationFinished here.
  // Once the splash animation is finished, it should never replay during the app session.
  // The splashAnimationFinished state is initialized to false in the store,
  // and is set to true when the animation completes via onAnimationFinish.

  // Check for OTA updates AFTER splash completes (not before)
  // This prevents update checks from interfering with splash animation
  // and ensures updates work correctly in production builds
  useUpdates({ enabled: splashAnimationFinished });

  // ── Boot Guard: mark boot completed when app is fully up ─────────
  useEffect(() => {
    if (splashAnimationFinished && authStatus !== "loading") {
      markBootCompleted();
      AppTrace.trace("BOOT", "boot_completed", {
        authStatus,
        isAuthenticated,
        safeMode: isSafeMode(),
      });
      if (isSafeMode()) {
        console.warn(
          "[RootLayout] Boot completed in SAFE MODE",
          getBootDiagnostics(),
        );
      }
    }
  }, [splashAnimationFinished, authStatus, isAuthenticated]);

  useEffect(() => {
    AppTrace.setContext({
      authStatus,
      isAuthenticated,
      userId,
    });
  }, [authStatus, isAuthenticated, userId]);

  useEffect(() => {
    if (authStatus === "loading") return;
    AppTrace.trace("AUTH", "auth_state_resolved", {
      authStatus,
      isAuthenticated,
      hasSeenOnboarding,
      hasUser: Boolean(userId),
    });
  }, [authStatus, hasSeenOnboarding, isAuthenticated, userId]);

  // ── Share Intent — receive content from other apps ──────────────────
  // Initialize push notifications
  useNotifications();

  // Device-aware screen orientation (deferred to after mount — native module must be ready)
  useEffect(() => {
    const run = async () => {
      try {
        const { width } = Dimensions.get("window");
        const tablet = width >= 768;
        if (!tablet) {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          );
        } else {
          await ScreenOrientation.unlockAsync();
        }
      } catch (e) {
        console.warn("[RootLayout] ScreenOrientation init failed:", e);
      }
    };
    run();
  }, []);

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
          if ((data.type === "comment" || data.type === "mention") && data.postId) {
            route = getPostDetailCommentsRoute(
              String(data.postId),
              typeof data.commentId === "string" ? data.commentId : undefined,
            );
          } else if (data.postId) {
            route = getPostDetailRoute(String(data.postId));
          }
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
      .then((res) => {
        console.log("[RootLayout] Supabase Health OK - Status:", res.status);
        AppTrace.trace("BOOT", "supabase_health_ok", { status: res.status });
      })
      .catch((err) => {
        console.error("[RootLayout] Supabase Health FAIL:", err);
        AppTrace.error("BOOT", "supabase_health_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // Load auth state — single call, no retry loop
    AppTrace.trace("AUTH", "auth_load_started");
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

  // Skip splash when opening from share intent — get to ShareIntentHandler faster
  useEffect(() => {
    if (openedFromShareIntent && !splashAnimationFinished) {
      onAnimationFinish(false);
    }
  }, [openedFromShareIntent, splashAnimationFinished, onAnimationFinish]);

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

  // ── Execute queued share-intent route ────────────────────────────────
  // Share intents arrive during boot via ShareIntentHandler. Queue the
  // destination until the protected stack is mounted, then push once.
  useEffect(() => {
    if (
      !splashAnimationFinished ||
      !authSettled ||
      !isAuthenticated ||
      !pendingShareIntentRoute
    ) {
      return;
    }

    const route = useAppStore.getState().consumePendingShareIntentRoute();
    if (route) {
      setTimeout(() => {
        console.log("[RootLayout] Executing queued share route:", route);
        router.push(route as any);
      }, 100);
    }
  }, [
    authSettled,
    isAuthenticated,
    pendingShareIntentRoute,
    splashAnimationFinished,
  ]);

  // Show animated splash until BOTH app is ready AND animation is finished
  // IMPORTANT: Always wait for splashAnimationFinished, even if appReady is true
  const showAnimatedSplash = !splashAnimationFinished;

  if (showAnimatedSplash) {
    return (
      <LayoutAnimationConfig skipEntering skipExiting>
        <ErrorBoundary
          screenName="Splash"
          fallback={
            <View
              style={{
                flex: 1,
                backgroundColor: "#000",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={() => onAnimationFinish(false)}
                style={{ padding: 24 }}
              >
                <Text style={{ color: "#fff", fontSize: 16 }}>
                  Tap to continue
                </Text>
              </Pressable>
            </View>
          }
        >
          <AnimatedSplashScreen onAnimationFinish={onAnimationFinish} />
        </ErrorBoundary>
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
        <LayoutAnimationConfig skipEntering={false} skipExiting={false}>
          <BottomSheetModalProvider>
            <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
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
                    <LikesSheetProvider>
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
                            animationDuration: 100,
                            contentStyle: { backgroundColor: "#000" },
                          }}
                        >
                          <Stack.Protected guard={!isAuthenticated}>
                            <Stack.Screen
                              name="(auth)"
                              options={{ animation: "none" }}
                            />
                          </Stack.Protected>
                          <Stack.Protected
                            guard={!isAuthenticated && hasSeenOnboarding}
                          >
                            <Stack.Screen
                              name="(public)"
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
                                headerShown: false,
                                presentation: "fullScreenModal",
                                animation: "slide_from_bottom",
                                animationDuration: 300,
                                gestureEnabled: true,
                                gestureDirection: "vertical",
                              }}
                            />
                          </Stack.Protected>
                        </Stack>
                        {/* Share intent — deferred 4s after main app (expo-share-intent SDK 55/RN 0.84 crash workaround) */}
                        {shareIntentReady && (
                          <ErrorBoundary
                            screenName="ShareIntent"
                            fallback={null}
                          >
                            <ShareIntentHandler />
                          </ErrorBoundary>
                        )}
                        {/* BiometricLock renders ONLY after auth is settled + authenticated. */}
                        {isAuthenticated && <BiometricLock />}
                        {/* Safe Mode Banner — shown when boot guard detects crash loop */}
                        {isSafeMode() && <SafeModeBanner />}
                        {__DEV__ && <DeviceTestBridge />}
                        <PublicGateSheet />
                        {/* Spotify share sheet — renders when a Spotify link is received */}
                        <SpotifyShareSheet />
                        {/* Auth loading overlay — covers content but does NOT unmount navigation.
                          Skip when opened from share intent so user sees content instead of black. */}
                        {!authSettled &&
                          !openedFromShareIntent &&
                          !isAuthenticated && (
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
                          >
                            {userId ? (
                              <FeedSkeleton />
                            ) : (
                              <View
                                style={{
                                  flex: 1,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <ActivityIndicator
                                  size="small"
                                  color="#3FDCFF"
                                />
                              </View>
                            )}
                          </View>
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
                    </LikesSheetProvider>
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
