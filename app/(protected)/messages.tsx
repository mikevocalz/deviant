import { View, Text, Pressable, ScrollView, TouchableOpacity } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Edit } from "lucide-react-native"
import { Image } from "expo-image"
import { useCallback } from "react"

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

  const handleChatPress = useCallback((id: string) => {
    router.push(`/(protected)/chat/${id}`)
  }, [router])

  const handleProfilePress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        borderBottomWidth: 1, 
        borderBottomColor: "#1a1a1a", 
        paddingHorizontal: 16, 
        paddingVertical: 12 
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Messages</Text>
        <Pressable onPress={() => router.push("/(protected)/messages/new")} hitSlop={12}>
          <Edit size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {conversations.map((item) => (
          <View
            key={item.id}
            style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              gap: 12, 
              borderBottomWidth: 1, 
              borderBottomColor: "#1a1a1a", 
              paddingHorizontal: 16, 
              paddingVertical: 12 
            }}
          >
            <Pressable onPress={() => handleProfilePress(item.user.username)}>
              <View style={{ position: "relative" }}>
                <Image source={{ uri: item.user.avatar }} style={{ height: 56, width: 56, borderRadius: 28 }} />
                {item.unread && (
                  <View style={{ 
                    position: "absolute", 
                    bottom: 0, 
                    right: 0, 
                    height: 14, 
                    width: 14, 
                    borderRadius: 7, 
                    borderWidth: 2, 
                    borderColor: "#000", 
                    backgroundColor: "#3EA4E5" 
                  }} />
                )}
              </View>
            </Pressable>
            
            <TouchableOpacity
              onPress={() => handleChatPress(item.id)}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pressable onPress={() => handleProfilePress(item.user.username)}>
                  <Text style={{ fontSize: 16, fontWeight: item.unread ? "700" : "500", color: "#fff" }}>
                    {item.user.username}
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 12, color: "#666" }}>{item.timeAgo}</Text>
              </View>
              <Text
                style={{ fontSize: 14, color: item.unread ? "#fff" : "#666", marginTop: 2 }}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {conversations.length === 0 && (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Text style={{ color: "#666", fontSize: 16 }}>No messages yet</Text>
            <Pressable 
              onPress={() => router.push("/(protected)/messages/new")}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: "#3EA4E5", fontWeight: "600" }}>Start a conversation</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
