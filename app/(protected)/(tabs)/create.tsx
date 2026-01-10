import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native"
import { Main } from "@expo/html-elements"
import { X } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import type { MediaAsset } from "@/lib/hooks/use-media-picker"
import { MediaPickerNative } from "@/components/media-picker-native"
import { useCreatePostStore } from "@/lib/stores/create-post-store"

export default function CreateScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { caption, location, setCaption, setLocation, reset } = useCreatePostStore()
  const { selectedMedia, setSelectedMedia } = useCreatePostStore()

  const handlePost = async () => {
    if (selectedMedia.length === 0) {
      Alert.alert("No Media", "Please select at least one photo or video")
      return
    }

    console.log("[v0] Creating post with:", { caption, location, mediaCount: selectedMedia.length })

    // TODO: Upload media and create post
    Alert.alert("Success", "Post created successfully!")

    // Reset and go back
    reset()
    router.back()
  }

  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <X size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold">New Post</Text>
          <Pressable onPress={handlePost}>
            <Text className="font-semibold text-primary">Share</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Caption Input */}
          <View className="border-b border-border p-4">
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption..."
              placeholderTextColor="#999"
              multiline
              maxLength={2200}
              className="min-h-[100px] text-base text-foreground"
            />
            <Text className="mt-2 text-xs text-muted-foreground">{caption.length}/2200</Text>
          </View>

          <MediaPickerNative selectedMedia={selectedMedia} onMediaSelected={setSelectedMedia} maxSelection={10} />

          {/* Location */}
          <View className="border-t border-border p-4">
            <Text className="mb-2 text-sm font-semibold">Add location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Where are you?"
              placeholderTextColor="#999"
              className="rounded-lg bg-secondary p-3 text-foreground"
            />
          </View>
        </ScrollView>
      </Main>
    </View>
  )
}
