import { Tabs, Link, useRouter, usePathname } from "expo-router";
import { Dimensions, View, Pressable, Text, Platform } from "react-native";
import {
  Home,
  Search,
  Plus,
  Heart,
  User,
  MessageSquare,
  CalendarDays,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import Logo from "@/components/logo";
import { CenterButton } from "@/components/center-button";
import { useUnreadMessageCount } from "@/lib/hooks/use-messages";
import { useIsLargeScreen } from "@/lib/hooks/use-is-large-screen";
import { PhoneTabBar, TabletTabBar } from "@/components/tab-bar";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";
import "@/lib/perf/tab-prefetches"; // Register prefetch functions for tab navigation

function HeaderLogo() {
  const pathname = usePathname();
  const triggerScrollToTop = useFeedScrollStore((s) => s.triggerScrollToTop);
  const isHome = pathname === "/" || pathname === "/(protected)/(tabs)";
  return (
    <Pressable
      onPress={() => {
        if (isHome) triggerScrollToTop();
      }}
      hitSlop={12}
    >
      <Logo
        width={100}
        height={36}
        style={{ marginBottom: Platform.OS === "android" ? 4 : 8 }}
      />
    </Pressable>
  );
}

function HeaderRight() {
  const { colors } = useColorScheme();
  const { data: unreadCount = 0 } = useUnreadMessageCount();
  return (
    <View className="mr-4 flex-row items-center gap-5">
      {/* CRITICAL: Use <Link> not router.push() — Link resolves navigation
          at press time from the current context, never captures a stale
          router reference. This survives OTA reloads. */}
      <Link href="/(protected)/search" asChild>
        <Pressable
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          className="p-1.5"
        >
          <Search size={24} color={colors.foreground} />
        </Pressable>
      </Link>
      <Link href="/(protected)/messages" asChild>
        <Pressable
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          className="relative p-1.5"
        >
          <MessageSquare size={24} color={colors.foreground} />
          {unreadCount > 0 && (
            <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-accent">
              <Text className="text-[10px] font-bold text-accent-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Link>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const isLargeScreen = useIsLargeScreen();
  const triggerScrollToTop = useFeedScrollStore((s) => s.triggerScrollToTop);

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          width: isLargeScreen ? Dimensions.get("screen").width - 72 : "100%",
        },
        headerShown: true,
        headerTitleAlign: "left",
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitle: () => <HeaderLogo />,
        headerRight: () => <HeaderRight />,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
      }}
      tabBar={(props) =>
        isLargeScreen ? <TabletTabBar {...props} /> : <PhoneTabBar {...props} />
      }
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: (e) => {
            // If already on home tab, scroll feed to top instead of navigating
            const pathname = router.canGoBack?.() ? "" : "/";
            triggerScrollToTop();
          },
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <Home
                size={24}
                color={focused ? colors.foreground : colors.mutedForeground}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <CalendarDays
                size={24}
                color={focused ? colors.foreground : colors.mutedForeground}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/(protected)/(tabs)/create");
          },
        }}
        options={{
          title: "",
          tabBarButton: (props) => (
            <CenterButton
              onPress={() => router.push("/(protected)/(tabs)/create")}
              Icon={Plus}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <Heart
                size={24}
                color={focused ? colors.foreground : colors.mutedForeground}
                strokeWidth={focused ? 2.5 : 2}
                fill={focused ? colors.foreground : "none"}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center justify-center">
              <User
                size={24}
                color={focused ? colors.foreground : colors.mutedForeground}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
