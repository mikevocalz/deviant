import { Tabs, useRouter } from "expo-router"
import { View, Pressable, Text } from "react-native"
import { Image } from "expo-image"
import { Home, Search, PlusSquare, Heart, User, MessageSquare, CalendarDays } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

export default function TabsLayout() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitle: () => (
            <Image
              source={{ uri: "https://placehold.co/192x64/6366f1/white?text=Social" }}
              style={{ width: 96, height: 32 }}
              contentFit="contain"
            />
        ),
        headerRight: () => (
          <View className="mr-4 flex-row items-center gap-4">
            <Pressable onPress={() => router.push("/(protected)/search")}>
              <Search size={24} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={() => router.push("/(protected)/messages")} className="relative">
              <MessageSquare size={24} color={colors.foreground} />
              <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-accent">
                <Text className="text-[10px] font-bold text-accent-foreground">3</Text>
              </View>
            </Pressable>
          </View>
        ),
        tabBarShowLabel: false,
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
              <Home size={24} color={focused ? colors.foreground : colors.mutedForeground} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center mt-5 justify-center">
              <CalendarDays size={24} color={focused ? colors.foreground : colors.mutedForeground} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center mt-0.5 justify-center">
              <PlusSquare size={24} color={focused ? colors.foreground : colors.mutedForeground} strokeWidth={focused ? 2.5 : 2} />
            </View>
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
              <User size={24} color={focused ? colors.foreground : colors.mutedForeground} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  )
}
