import { View, Text, Pressable, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Edit } from "lucide-react-native"
import { Image } from "expo-image"

const conversations = [
  {
    id: "1",
    user: { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5" },
    lastMessage: "Hey! How are you doing?",
    timeAgo: "2m",
    unread: true,
  },
  {
    id: "2",
    user: { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17" },
    lastMessage: "That workout was intense! 💪",
    timeAgo: "1h",
    unread: true,
  },
  {
    id: "3",
    user: { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14" },
    lastMessage: "Thanks for the feedback on my art!",
    timeAgo: "3h",
    unread: false,
  },
  {
    id: "4",
    user: { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15" },
    lastMessage: "Check out this new lens I got",
    timeAgo: "1d",
    unread: false,
  },
]

export default function MessagesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const handleChatPress = (id: string) => {
    router.push(`/(protected)/chat/${id}`)
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>Messages</Text>
        <Pressable onPress={() => router.push("/(protected)/messages/new")}>
          <Edit size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Conversations List */}
      <ScrollView>
        {conversations.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleChatPress(item.id)}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <View style={{ position: "relative" }}>
              <Image source={{ uri: item.user.avatar }} style={{ height: 56, width: 56, borderRadius: 28 }} />
              {item.unread && (
                <View style={{ position: "absolute", bottom: 0, right: 0, height: 12, width: 12, borderRadius: 6, borderWidth: 2, borderColor: "#000", backgroundColor: "#6366f1" }} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: item.unread ? "700" : "500", color: "#fff" }}>
                {item.user.username}
              </Text>
              <Text
                style={{ fontSize: 14, color: item.unread ? "#fff" : "#999" }}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: "#999" }}>{item.timeAgo}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}
