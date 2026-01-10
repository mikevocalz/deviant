import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Animated } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { ArrowLeft, Send } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useChatStore, allUsers } from "@/lib/stores/chat-store"
import { useRef, useCallback, useMemo } from "react"

const mockMessages = [
  { id: "1", text: "Hey! How are you doing?", sender: "them" as const, time: "10:30 AM" },
  { id: "2", text: "I'm good! Just working on some projects", sender: "me" as const, time: "10:32 AM" },
  { id: "3", text: "That sounds great! What kind of projects?", sender: "them" as const, time: "10:33 AM" },
  { id: "4", text: "Building a social media app with React Native", sender: "me" as const, time: "10:35 AM" },
  { id: "5", text: "Oh nice! I'd love to see it when it's done", sender: "them" as const, time: "10:36 AM" },
]

const users: Record<string, { username: string; avatar: string; name: string }> = {
  "1": { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5", name: "Emma Wilson" },
  "2": { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17", name: "John Fitness" },
  "3": { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14", name: "Sarah Artist" },
  "4": { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15", name: "Mike Photo" },
}

function renderMessageText(text: string, onMentionPress: (username: string) => void) {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const username = part.slice(1)
      return (
        <Text
          key={index}
          onPress={() => onMentionPress(username)}
          style={{ color: "#3EA4E5", fontWeight: "600" }}
        >
          {part}
        </Text>
      )
    }
    return <Text key={index}>{part}</Text>
  })
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const chatId = id || "1"
  const { 
    messages, 
    currentMessage, 
    setCurrentMessage, 
    sendMessage,
    mentionQuery,
    showMentions,
    setCursorPosition,
    insertMention
  } = useChatStore()
  
  const chatMessages = messages[chatId] || mockMessages
  const user = users[chatId] || users["1"]
  const inputRef = useRef<TextInput>(null)
  const sendButtonScale = useRef(new Animated.Value(1)).current

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return allUsers.slice(0, 5)
    return allUsers.filter(u => 
      u.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5)
  }, [mentionQuery])

  const handleSend = useCallback(() => {
    if (!currentMessage.trim()) return
    
    Animated.sequence([
      Animated.timing(sendButtonScale, { toValue: 0.9, duration: 50, useNativeDriver: true }),
      Animated.timing(sendButtonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start()
    
    sendMessage(chatId)
  }, [chatId, currentMessage, sendMessage, sendButtonScale])

  const handleMentionSelect = useCallback((username: string) => {
    insertMention(username)
    inputRef.current?.focus()
  }, [insertMention])

  const handleTextChange = useCallback((text: string) => {
    setCurrentMessage(text)
  }, [setCurrentMessage])

  const handleSelectionChange = useCallback((event: { nativeEvent: { selection: { start: number; end: number } } }) => {
    setCursorPosition(event.nativeEvent.selection.end)
  }, [setCursorPosition])

  const handleMentionPress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  const handleProfilePress = useCallback(() => {
    router.push(`/(protected)/profile/${user.username}`)
  }, [router, user.username])

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        gap: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: "#1a1a1a", 
        paddingHorizontal: 16, 
        paddingVertical: 12 
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={handleProfilePress} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <Image source={{ uri: user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{user.username}</Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Active now</Text>
          </View>
        </Pressable>
      </View>

      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        inverted={false}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.sender === "me" ? "flex-end" : "flex-start",
              backgroundColor: item.sender === "me" ? "#3EA4E5" : "#1a1a1a",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              maxWidth: "80%",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15 }}>
              {renderMessageText(item.text, handleMentionPress)}
            </Text>
            <Text style={{ 
              color: item.sender === "me" ? "rgba(255,255,255,0.7)" : "#666", 
              fontSize: 11, 
              marginTop: 4 
            }}>
              {item.time}
            </Text>
          </View>
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <View style={{ 
          backgroundColor: "#111", 
          borderTopWidth: 1, 
          borderTopColor: "#1a1a1a",
          maxHeight: 200
        }}>
          <Text style={{ 
            color: "#666", 
            fontSize: 12, 
            paddingHorizontal: 16, 
            paddingTop: 12, 
            paddingBottom: 8 
          }}>
            Mention a user
          </Text>
          {filteredUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => handleMentionSelect(u.username)}
              style={{ 
                flexDirection: "row", 
                alignItems: "center", 
                gap: 12, 
                paddingHorizontal: 16, 
                paddingVertical: 10,
                backgroundColor: "#111"
              }}
            >
              <Image source={{ uri: u.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              <View>
                <Text style={{ color: "#fff", fontWeight: "500" }}>{u.username}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{u.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          gap: 12, 
          borderTopWidth: 1, 
          borderTopColor: "#1a1a1a", 
          paddingHorizontal: 16, 
          paddingVertical: 12 
        }}>
          <TextInput
            ref={inputRef}
            value={currentMessage}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder="Message... (use @ to mention)"
            placeholderTextColor="#666"
            style={{ 
              flex: 1, 
              minHeight: 40,
              maxHeight: 100,
              backgroundColor: "#1a1a1a", 
              borderRadius: 20, 
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: "#fff" 
            }}
            multiline
          />
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <Pressable 
              onPress={handleSend} 
              disabled={!currentMessage.trim()}
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: currentMessage.trim() ? "#3EA4E5" : "#1a1a1a", 
                justifyContent: "center", 
                alignItems: "center" 
              }}
            >
              <Send size={20} color={currentMessage.trim() ? "#fff" : "#666"} />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
