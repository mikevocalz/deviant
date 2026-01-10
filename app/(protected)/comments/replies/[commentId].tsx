import { View, Text, TextInput, Pressable, ScrollView, Keyboard, Platform } from "react-native"
import { KeyboardAvoidingView } from "react-native-keyboard-controller"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { ArrowLeft, Send, Heart } from "lucide-react-native"
import { useMemo, useEffect } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { feedPosts } from "@/lib/constants"
import type { Comment } from "@/lib/constants"
import { useCommentsStore } from "@/lib/stores/comments-store"

export const unstable_settings = {
  options: {
    detents: ["medium", "large"],
    cornerRadius: 16,
  },
}

export default function RepliesScreen() {
  const { commentId } = useLocalSearchParams<{ commentId: string }>()
  const router = useRouter()
  const { newComment: reply, setNewComment: setReply } = useCommentsStore()
  const insets = useSafeAreaInsets()
  
  // Find the comment and its replies
  const replies = useMemo(() => {
    for (const post of feedPosts) {
      for (const comment of post.comments) {
        if (comment.id === commentId) {
          return comment.replies || []
        }
      }
    }
    return []
  }, [commentId])
  
  
  const handleSend = () => {
    if (!reply.trim()) return
    setReply("")
    Keyboard.dismiss()
  }

  // Handle keyboard dismiss
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Clear reply state when keyboard is dismissed
    })

    return () => {
      keyboardDidHideListener.remove()
    }
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Replies</Text>
      </View>

      {/* Replies List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {!replies || replies.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "#999" }}>No replies yet</Text>
          </View>
        ) : (
          replies.map((item: Comment) => (
            <View key={item.id} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Image source={{ uri: item.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontWeight: "600", fontSize: 14, color: "#fff" }}>{item.username}</Text>
                    <Text style={{ color: "#999", fontSize: 12 }}>{item.timeAgo}</Text>
                  </View>
                  <Text style={{ fontSize: 14, marginTop: 4, lineHeight: 20, color: "#fff" }}>{item.text}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
                    <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Heart size={16} color="#999" />
                      <Text style={{ color: "#999", fontSize: 12 }}>{item.likes}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Add a reply..."
            placeholderTextColor="#999"
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            enablesReturnKeyAutomatically={true}
            style={{ flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: "#1f1f1f", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: "#fff" }}
          />
          <Pressable onPress={handleSend} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" }}>
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}
