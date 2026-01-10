import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { ArrowLeft, Send } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useChatStore } from "@/lib/stores/chat-store"

export const unstable_settings = {
  options: {
    detents: ["large"],
    cornerRadius: 16,
  },
}

const mockMessages = [
  { id: "1", text: "Hey! How are you doing?", sender: "them" as const, time: "10:30 AM" },
  { id: "2", text: "I'm good! Just working on some projects", sender: "me" as const, time: "10:32 AM" },
  { id: "3", text: "That sounds great! What kind of projects?", sender: "them" as const, time: "10:33 AM" },
  { id: "4", text: "Building a social media app with React Native", sender: "me" as const, time: "10:35 AM" },
  { id: "5", text: "Oh nice! I'd love to see it when it's done", sender: "them" as const, time: "10:36 AM" },
]

const users: Record<string, { username: string; avatar: string }> = {
  "1": { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5" },
  "2": { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17" },
  "3": { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14" },
  "4": { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15" },
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const chatId = id || "1"
  const { messages, currentMessage, setCurrentMessage, sendMessage } = useChatStore()
  const chatMessages = messages[chatId] || mockMessages

  const user = users[chatId] || users["1"]

  const handleSend = () => {
    sendMessage(chatId)
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Image source={{ uri: user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{user.username}</Text>
          <Text style={{ fontSize: 12, color: "#999" }}>Active now</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.sender === "me" ? "flex-end" : "flex-start",
              backgroundColor: item.sender === "me" ? "#6366f1" : "#1f1f1f",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              maxWidth: "80%",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15 }}>
              {item.text}
            </Text>
            <Text style={{ color: item.sender === "me" ? "rgba(255,255,255,0.7)" : "#999", fontSize: 11, marginTop: 4 }}>
              {item.time}
            </Text>
          </View>
        )}
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TextInput
            value={currentMessage}
            onChangeText={setCurrentMessage}
            placeholder="Message..."
            placeholderTextColor="#999"
            style={{ flex: 1, height: 40, backgroundColor: "#1f1f1f", borderRadius: 20, paddingHorizontal: 16, color: "#fff" }}
          />
          <Pressable onPress={handleSend} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" }}>
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
