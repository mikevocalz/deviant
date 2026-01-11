import { View, Text, Pressable, ScrollView, TouchableOpacity } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Edit } from "lucide-react-native"
import { Image } from "expo-image"
import { useCallback, useEffect } from "react"
import { MessagesSkeleton } from "@/components/skeletons"
import { useUIStore } from "@/lib/stores/ui-store"

const conversations = [
  {
    id: "1",
    user: { username: "emma_wilson", name: "Emma Wilson", avatar: "https://i.pravatar.cc/150?img=5" },
    lastMessage: "Hey! How are you doing?",
    timeAgo: "2m",
    unread: true,
  },
  {
    id: "2",
    user: { username: "john_fitness", name: "John Fitness", avatar: "https://i.pravatar.cc/150?img=17" },
    lastMessage: "That workout was intense! 💪",
    timeAgo: "1h",
    unread: true,
  },
  {
    id: "3",
    user: { username: "sarah_artist", name: "Sarah Artist", avatar: "https://i.pravatar.cc/150?img=14" },
    lastMessage: "Thanks for the feedback on my art!",
    timeAgo: "3h",
    unread: false,
  },
  {
    id: "4",
    user: { username: "mike_photo", name: "Mike Photo", avatar: "https://i.pravatar.cc/150?img=15" },
    lastMessage: "Check out this new lens I got",
    timeAgo: "1d",
    unread: false,
  },
]

export default function MessagesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { loadingScreens, setScreenLoading } = useUIStore()
  const isLoading = loadingScreens.messages

  useEffect(() => {
    const loadMessages = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      setScreenLoading("messages", false)
    }
    loadMessages()
  }, [setScreenLoading])

  const handleChatPress = useCallback((id: string) => {
    router.push(`/(protected)/chat/${id}`)
  }, [router])

  const handleProfilePress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <MessagesSkeleton />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground">Messages</Text>
        <Pressable onPress={() => router.push("/(protected)/messages/new")} hitSlop={12}>
          <Edit size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {conversations.map((item) => (
          <View
            key={item.id}
            className="flex-row items-center gap-3 border-b border-border px-4 py-3"
          >
            <Pressable onPress={() => handleProfilePress(item.user.username)}>
              <View className="relative">
                <Image source={{ uri: item.user.avatar }} className="h-14 w-14 rounded-full" />
                {item.unread && (
                  <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
                )}
              </View>
            </Pressable>
            
            <TouchableOpacity
              onPress={() => handleChatPress(item.id)}
              activeOpacity={0.7}
              className="flex-1"
            >
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => handleProfilePress(item.user.username)}>
                  <Text className={`text-base text-foreground ${item.unread ? "font-bold" : "font-medium"}`}>
                    {item.user.username}
                  </Text>
                </Pressable>
                <Text className="text-xs text-muted-foreground">{item.timeAgo}</Text>
              </View>
              <Text
                className={`text-sm mt-0.5 ${item.unread ? "text-foreground" : "text-muted-foreground"}`}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {conversations.length === 0 && (
          <View className="items-center justify-center py-16">
            <Text className="text-muted-foreground text-base">No messages yet</Text>
            <Pressable 
              onPress={() => router.push("/(protected)/messages/new")}
              className="mt-4"
            >
              <Text className="text-primary font-semibold">Start a conversation</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
