import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Animated, Alert } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Image } from "expo-image"
import { ArrowLeft, Send, ImageIcon, X, Play } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useChatStore, allUsers, Message, MediaAttachment } from "@/lib/stores/chat-store"
import { useRef, useCallback, useMemo, useState, useEffect } from "react"
import { ChatSkeleton } from "@/components/skeletons"
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
          className="text-primary font-semibold"
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
    <Pressable onPress={onPress} className="w-[200px] h-[200px] rounded-xl overflow-hidden mb-2">
      {media.type === "image" ? (
        <Image source={{ uri: media.uri }} className="w-full h-full" contentFit="cover" />
      ) : (
        <View className="w-full h-full relative">
          <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls={false} />
          <View className="absolute inset-0 justify-center items-center bg-black/30">
            <LinearGradient
              colors={["rgba(52,162,223,0.8)", "rgba(138,64,207,0.8)", "rgba(255,91,252,0.8)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-11 h-11 rounded-full justify-center items-center"
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadChat = async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
      setIsLoading(false)
    }
    loadChat()
  }, [])

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

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ChatSkeleton />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={handleProfilePress} className="flex-row items-center gap-3 flex-1">
          <Image source={{ uri: user.avatar }} className="w-10 h-10 rounded-full" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">{user.username}</Text>
            <Text className="text-xs text-muted-foreground">Active now</Text>
          </View>
        </Pressable>
      </View>

      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 gap-2"
        inverted={false}
        renderItem={({ item }) => (
          <View className={`px-4 py-2.5 rounded-2xl max-w-[80%] mb-2 ${
            item.sender === "me" ? "self-end bg-primary" : "self-start bg-secondary"
          }`}>
            {item.media && (
              <MediaMessage media={item.media} onPress={() => handleMediaPreview(item.media!)} />
            )}
            {item.text ? (
              <Text className="text-foreground text-[15px]">
                {renderMessageText(item.text, handleMentionPress)}
              </Text>
            ) : null}
            <Text className={`text-[11px] mt-1 ${
              item.sender === "me" ? "text-foreground/70" : "text-muted-foreground"
            }`}>
              {item.time}
            </Text>
          </View>
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <View className="bg-card border-t border-border max-h-[200px]">
          <Text className="text-muted-foreground text-xs px-4 pt-3 pb-2">Mention a user</Text>
          {filteredUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => handleMentionSelect(u.username)}
              className="flex-row items-center gap-3 px-4 py-2.5 bg-card"
            >
              <Image source={{ uri: u.avatar }} className="w-9 h-9 rounded-full" />
              <View>
                <Text className="text-foreground font-medium">{u.username}</Text>
                <Text className="text-muted-foreground text-xs">{u.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {pendingMedia && (
          <View className="flex-row items-center bg-secondary p-2 mx-4 mt-2 rounded-xl gap-3">
            <Image source={{ uri: pendingMedia.uri }} className="w-12 h-12 rounded-lg" contentFit="cover" />
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-sm">{pendingMedia.type === "video" ? "Video" : "Photo"}</Text>
              <Text className="text-muted-foreground text-xs">Ready to send</Text>
            </View>
            <Pressable onPress={() => setPendingMedia(null)} className="w-8 h-8 rounded-full bg-white/10 justify-center items-center">
              <X size={18} color="#fff" />
            </Pressable>
          </View>
        )}
        
        <View className="flex-row items-center gap-2 border-t border-border px-3 py-3">
          <Pressable onPress={handlePickMedia} className="w-10 h-10 rounded-full bg-secondary justify-center items-center">
            <ImageIcon size={22} color="#3EA4E5" />
          </Pressable>
          
          <TextInput
            ref={inputRef}
            value={currentMessage}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder="Message... (use @ to mention)"
            placeholderTextColor="#666"
            className="flex-1 min-h-[40px] max-h-[100px] bg-secondary rounded-full px-4 py-2.5 text-foreground"
            multiline
          />
          
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <Pressable 
              onPress={handleSend} 
              disabled={!canSend}
              className={`w-10 h-10 rounded-full justify-center items-center ${
                canSend ? "bg-primary" : "bg-secondary"
              }`}
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
