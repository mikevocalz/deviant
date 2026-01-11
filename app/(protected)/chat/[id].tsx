import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Animated, StyleSheet, Alert } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { ArrowLeft, Send, ImageIcon, X, Play } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useChatStore, allUsers, Message, MediaAttachment } from "@/lib/stores/chat-store"
import { useRef, useCallback, useMemo, useState } from "react"
import * as ImagePicker from "expo-image-picker"
import { MediaPreviewModal } from "@/components/media-preview-modal"
import { VideoView, useVideoPlayer } from "expo-video"
import { LinearGradient } from "expo-linear-gradient"

const mockMessages: Message[] = [
  { id: "1", text: "Hey! How are you doing?", sender: "them", time: "10:30 AM" },
  { id: "2", text: "I'm good! Just working on some projects", sender: "me", time: "10:32 AM" },
  { id: "3", text: "That sounds great! What kind of projects?", sender: "them", time: "10:33 AM" },
  { id: "4", text: "Building a social media app with React Native", sender: "me", time: "10:35 AM" },
  { id: "5", text: "Oh nice! I'd love to see it when it's done", sender: "them", time: "10:36 AM" },
]

const users: Record<string, { username: string; avatar: string; name: string }> = {
  "1": { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5", name: "Emma Wilson" },
  "2": { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17", name: "John Fitness" },
  "3": { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14", name: "Sarah Artist" },
  "4": { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15", name: "Mike Photo" },
}

function renderMessageText(text: string, onMentionPress: (username: string) => void) {
  if (!text) return null
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const username = part.slice(1)
      return (
        <Text
          key={index}
          onPress={() => onMentionPress(username)}
          style={{ color: "#3EA4E5", fontWeight: "600" as const }}
        >
          {part}
        </Text>
      )
    }
    return <Text key={index}>{part}</Text>
  })
}

interface MediaMessageProps {
  media: MediaAttachment
  onPress: () => void
}

function MediaMessage({ media, onPress }: MediaMessageProps) {
  const player = useVideoPlayer(
    media.type === "video" ? media.uri : "",
    (p) => { p.loop = false }
  )

  return (
    <Pressable onPress={onPress} style={styles.mediaMessage}>
      {media.type === "image" ? (
        <Image source={{ uri: media.uri }} style={styles.messageMedia} contentFit="cover" />
      ) : (
        <View style={styles.videoContainer}>
          <VideoView player={player} style={styles.messageMedia} contentFit="cover" nativeControls={false} />
          <View style={styles.playOverlay}>
            <LinearGradient
              colors={["rgba(52,162,223,0.8)", "rgba(138,64,207,0.8)", "rgba(255,91,252,0.8)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButton}
            >
              <Play size={20} color="#fff" fill="#fff" />
            </LinearGradient>
          </View>
        </View>
      )}
    </Pressable>
  )
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
    insertMention,
    pendingMedia,
    setPendingMedia
  } = useChatStore()
  
  const chatMessages = messages[chatId] || mockMessages
  const user = users[chatId] || users["1"]
  const inputRef = useRef<TextInput>(null)
  const sendButtonScale = useRef(new Animated.Value(1)).current
  
  const [previewMedia, setPreviewMedia] = useState<{ type: "image" | "video"; uri: string } | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return allUsers.slice(0, 5)
    return allUsers.filter(u => 
      u.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5)
  }, [mentionQuery])

  const handleSend = useCallback(() => {
    if (!currentMessage.trim() && !pendingMedia) return
    
    Animated.sequence([
      Animated.timing(sendButtonScale, { toValue: 0.9, duration: 50, useNativeDriver: true }),
      Animated.timing(sendButtonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start()
    
    sendMessage(chatId)
  }, [chatId, currentMessage, sendMessage, sendButtonScale, pendingMedia])

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

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const isVideo = asset.type === "video"
      
      if (isVideo && asset.duration && asset.duration > 60000) {
        Alert.alert("Video too long", "Please select a video under 60 seconds.")
        return
      }

      const media: MediaAttachment = {
        type: isVideo ? "video" : "image",
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        duration: asset.duration ?? undefined,
      }
      setPendingMedia(media)
    }
  }, [setPendingMedia])

  const handleMediaPreview = useCallback((media: MediaAttachment) => {
    setPreviewMedia({ type: media.type, uri: media.uri })
    setShowPreviewModal(true)
  }, [])

  const handleClosePreview = useCallback(() => {
    setShowPreviewModal(false)
    setPreviewMedia(null)
  }, [])

  const canSend = currentMessage.trim() || pendingMedia

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={handleProfilePress} style={styles.headerProfile}>
          <Image source={{ uri: user.avatar }} style={styles.headerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerUsername}>{user.username}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </Pressable>
      </View>

      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        renderItem={({ item }) => (
          <View style={[styles.messageBubble, item.sender === "me" ? styles.myMessage : styles.theirMessage]}>
            {item.media && (
              <MediaMessage media={item.media} onPress={() => handleMediaPreview(item.media!)} />
            )}
            {item.text ? (
              <Text style={styles.messageText}>
                {renderMessageText(item.text, handleMentionPress)}
              </Text>
            ) : null}
            <Text style={[styles.messageTime, item.sender === "me" ? styles.myMessageTime : styles.theirMessageTime]}>
              {item.time}
            </Text>
          </View>
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <View style={styles.mentionsContainer}>
          <Text style={styles.mentionsLabel}>Mention a user</Text>
          {filteredUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => handleMentionSelect(u.username)}
              style={styles.mentionItem}
            >
              <Image source={{ uri: u.avatar }} style={styles.mentionAvatar} />
              <View>
                <Text style={styles.mentionUsername}>{u.username}</Text>
                <Text style={styles.mentionName}>{u.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {pendingMedia && (
          <View style={styles.pendingMediaContainer}>
            <Image source={{ uri: pendingMedia.uri }} style={styles.pendingMediaThumb} contentFit="cover" />
            <View style={styles.pendingMediaInfo}>
              <Text style={styles.pendingMediaType}>{pendingMedia.type === "video" ? "Video" : "Photo"}</Text>
              <Text style={styles.pendingMediaText}>Ready to send</Text>
            </View>
            <Pressable onPress={() => setPendingMedia(null)} style={styles.removePendingMedia}>
              <X size={18} color="#fff" />
            </Pressable>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <Pressable onPress={handlePickMedia} style={styles.mediaButton}>
            <ImageIcon size={22} color="#3EA4E5" />
          </Pressable>
          
          <TextInput
            ref={inputRef}
            value={currentMessage}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder="Message... (use @ to mention)"
            placeholderTextColor="#666"
            style={styles.input}
            multiline
          />
          
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <Pressable 
              onPress={handleSend} 
              disabled={!canSend}
              style={[styles.sendButton, canSend ? styles.sendButtonActive : styles.sendButtonInactive]}
            >
              <Send size={20} color={canSend ? "#fff" : "#666"} />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <MediaPreviewModal
        visible={showPreviewModal}
        onClose={handleClosePreview}
        media={previewMedia}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  headerStatus: {
    fontSize: 12,
    color: "#999",
  },
  messagesList: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: "80%",
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#3EA4E5",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1a1a",
  },
  messageText: {
    color: "#fff",
    fontSize: 15,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.7)",
  },
  theirMessageTime: {
    color: "#666",
  },
  mediaMessage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  messageMedia: {
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  mentionsContainer: {
    backgroundColor: "#111",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    maxHeight: 200,
  },
  mentionsLabel: {
    color: "#666",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111",
  },
  mentionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  mentionUsername: {
    color: "#fff",
    fontWeight: "500",
  },
  mentionName: {
    color: "#666",
    fontSize: 12,
  },
  pendingMediaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 12,
  },
  pendingMediaThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  pendingMediaInfo: {
    flex: 1,
  },
  pendingMediaType: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  pendingMediaText: {
    color: "#666",
    fontSize: 12,
  },
  removePendingMedia: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonActive: {
    backgroundColor: "#3EA4E5",
  },
  sendButtonInactive: {
    backgroundColor: "#1a1a1a",
  },
})
