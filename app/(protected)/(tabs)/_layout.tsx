"use client";

import { Tabs, useRouter } from "expo-router";
import { View, Pressable, Text, Platform } from "react-native";
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

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { data: unreadCount = 0 } = useUnreadMessageCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "left",
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          //paddingBottom: 4,
        },
        headerTitle: () => (
          <Logo
            width={100}
            height={50}
            style={{ marginBottom: Platform.OS === "android" ? 4 : 12 }}
          />
        ),
        headerRight: () => (
          <View className="mr-4 flex-row items-center gap-4">
            <Pressable onPress={() => router.push("/(protected)/search")}>
              <Search size={24} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(protected)/messages")}
              className="relative"
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
          </View>
        ),
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center mt-5 justify-center">
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
            <View className="items-center mt-5 justify-center">
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
            <View className="items-center mt-5 justify-center">
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
            <View className="items-center mt-5 justify-center">
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
