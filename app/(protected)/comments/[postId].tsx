import { View, Text, TextInput, Pressable, ScrollView, Keyboard, Platform } from "react-native"
import { KeyboardAvoidingView } from "react-native-keyboard-controller"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { X, Send, Heart, MessageCircle } from "lucide-react-native"
import { useEffect } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getPostById } from "@/lib/constants"
import { useCommentsStore } from "@/lib/stores/comments-store"

export const unstable_settings = {
  options: {
    detents: ["medium", "large"],
    cornerRadius: 16,
  },
}

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { commentId } = useLocalSearchParams<{ commentId?: string }>()
  const router = useRouter()
  const { newComment: comment, replyingTo, setNewComment: setComment, setReplyingTo, clearComment } = useCommentsStore()
  const insets = useSafeAreaInsets()

  const post = getPostById(postId || "")
  const comments = post?.comments || []

  const handleSend = () => {
    if (!comment.trim()) return
    setComment("")
    setReplyingTo(null)
    Keyboard.dismiss()
  }

  // Handle keyboard dismiss
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setReplyingTo(null)
    })

    return () => {
      keyboardDidHideListener.remove()
    }
  }, [])

  const handleReply = (username: string, commentId: string) => {
    setReplyingTo(commentId)
    setComment(`@${username} `)
  }

  const handleViewReplies = (commentId: string) => {
    router.push(`/(protected)/comments/replies/${commentId}`)
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ width: 24 }} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Comments</Text>
        <Pressable onPress={() => router.back()}>
          <X size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Comments List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {comments.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "#999" }}>No comments yet</Text>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 8 }}>Post ID: {postId}</Text>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 4 }}>Try posts with IDs: f1, f2, f3, f4, f5</Text>
          </View>
        ) : (
          comments.map((item) => {
            const isHighlightedComment = item.id === commentId
            return (
              <View key={item.id} style={{ marginBottom: 20 }}>
                {/* Highlight border for targeted comment */}
                {isHighlightedComment && (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: "#6366f1", paddingLeft: 8, marginLeft: -11 }} />
                )}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Image source={{ uri: item.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontWeight: "600", fontSize: 14, color: "#fff" }}>{item.username}</Text>
                      <Text style={{ color: "#999", fontSize: 12 }}>{item.timeAgo}</Text>
                      {isHighlightedComment && (
                        <Text style={{ color: "#6366f1", fontSize: 11, fontWeight: "500" }}>• Viewing replies</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 14, marginTop: 4, lineHeight: 20, color: "#fff" }}>{item.text}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
                      <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Heart size={16} color="#999" />
                        <Text style={{ color: "#999", fontSize: 12 }}>{item.likes || 0}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleReply(item.username, item.id)}>
                        <Text style={{ color: "#999", fontSize: 12, fontWeight: "500" }}>Reply</Text>
                      </Pressable>
                    </View>

                    {/* Replies preview */}
                    {item.replies && item.replies.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        {/* Show all replies if this is the highlighted comment */}
                        {isHighlightedComment ? (
                          <>
                            <Text style={{ color: "#6366f1", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
                              All {item.replies.length} replies
                            </Text>
                            {item.replies.map((reply) => (
                              <View key={reply.id} style={{ flexDirection: "row", gap: 8, marginBottom: 8, marginLeft: 12 }}>
                                <Image source={{ uri: reply.avatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontWeight: "600", fontSize: 13, color: "#fff" }}>{reply.username}</Text>
                                    <Text style={{ color: "#999", fontSize: 11 }}>{reply.timeAgo}</Text>
                                  </View>
                                  <Text style={{ fontSize: 13, marginTop: 2, lineHeight: 18, color: "#fff" }}>{reply.text}</Text>
                                </View>
                              </View>
                            ))}
                          </>
                        ) : (
                          <>
                            {/* Show first 2 replies for other comments */}
                            {item.replies.slice(0, 2).map((reply) => (
                              <View key={reply.id} style={{ flexDirection: "row", gap: 8, marginBottom: 8, marginLeft: 12 }}>
                                <Image source={{ uri: reply.avatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontWeight: "600", fontSize: 13, color: "#fff" }}>{reply.username}</Text>
                                    <Text style={{ color: "#999", fontSize: 11 }}>{reply.timeAgo}</Text>
                                  </View>
                                  <Text style={{ fontSize: 13, marginTop: 2, lineHeight: 18, color: "#fff" }}>{reply.text}</Text>
                                </View>
                              </View>
                            ))}
                            
                            {/* View all replies link */}
                            <Pressable
                              onPress={() => handleViewReplies(item.id)}
                              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginLeft: 12 }}
                            >
                              <View style={{ width: 20, height: 1, backgroundColor: "#666" }} />
                              <Text style={{ color: "#999", fontSize: 12 }}>
                                View all {item.replies.length} {item.replies.length === 1 ? "reply" : "replies"}
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ borderTopWidth: 1, borderTopColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
          {replyingTo && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#999", fontSize: 12 }}>Replying to comment</Text>
              <Pressable onPress={() => { setReplyingTo(null); setComment(""); Keyboard.dismiss(); }}>
                <X size={16} color="#999" />
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment..."
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
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}
