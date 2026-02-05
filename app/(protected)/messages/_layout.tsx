/**
 * Messages Layout with Nested Tabs
 * Three tabs: Messages (Inbox), Requests, Sneaky Lynk
 */

import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Inbox, ShieldAlert, Radio } from "lucide-react-native";
import { useUnreadMessageCount } from "@/lib/hooks/use-messages";

function TabBarIcon({ 
  icon: Icon, 
  focused, 
  badge 
}: { 
  icon: typeof Inbox; 
  focused: boolean; 
  badge?: number;
}) {
  return (
    <View className="relative">
      <Icon size={22} color={focused ? "#3EA4E5" : "#6B7280"} />
      {badge && badge > 0 && (
        <View className="absolute -top-1 -right-2 bg-primary rounded-full min-w-[16px] h-4 items-center justify-center px-1">
          <Text className="text-[10px] text-white font-bold">{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function MessagesLayout() {
  const insets = useSafeAreaInsets();
  const { data: inboxUnreadCount = 0, spamCount: requestsUnreadCount = 0 } = useUnreadMessageCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "#262626",
          borderTopWidth: 1,
          height: 50,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#3EA4E5",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Messages",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon icon={Inbox} focused={focused} badge={inboxUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon icon={ShieldAlert} focused={focused} badge={requestsUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="sneaky-lynk"
        options={{
          title: "Sneaky Lynk",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon icon={Radio} focused={focused} />
          ),
        }}
      />
      {/* Hide room route from tab bar */}
      <Tabs.Screen
        name="sneaky-lynk/room/[id]"
        options={{
          href: null,
        }}
      />
      {/* Hide existing screens from tab bar */}
      <Tabs.Screen
        name="new"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="new-group"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
