import { View, Text, Pressable, TextInput, Dimensions, ScrollView, Alert } from "react-native"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { X, Image as ImageIcon, Video, Type, ChevronLeft, ChevronRight } from "lucide-react-native"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useCreateStoryStore } from "@/lib/stores/create-story-store"
import type { MediaAsset } from "@/lib/hooks/use-media-picker"
import { MediaPickerNative } from "@/components/media-picker-native"

const SCREEN_WIDTH = Dimensions.get("window").width

export default function CreateStoryScreen() {
  const router = useRouter()
  const {
    selectedMedia,
    mediaTypes,
    text,
    textColor,
    backgroundColor,
    setSelectedMedia,
    setText,
    setTextColor,
    setBackgroundColor,
    reset,
    showMediaPicker,
    setShowMediaPicker,
    currentIndex,
    setCurrentIndex,
    mediaAssets,
    setMediaAssets,
    nextSlide,
    prevSlide,
  } = useCreateStoryStore()

  const bgGradients = [
    { colors: ["#34A2DF", "#8A40CF"], label: "Blue Purple" },
    { colors: ["#8A40CF", "#FF5BFC"], label: "Purple Pink" },
    { colors: ["#34A2DF", "#FF5BFC"], label: "Blue Pink" },
    { colors: ["#FF5BFC", "#34A2DF"], label: "Pink Blue" },
    { colors: ["#8A40CF", "#34A2DF"], label: "Purple Blue" },
    { colors: ["#FF5BFC", "#8A40CF"], label: "Pink Purple" },
  ]

  const handleMediaSelected = (media: MediaAsset[]) => {
    if (media.length > 4) {
      Alert.alert("Maximum Selection", "You can select up to 4 items for a story")
      return
    }
    setMediaAssets(media)
    setSelectedMedia(
      media.map((m) => m.uri),
      media.map((m) => m.type),
    )
    setShowMediaPicker(false)
  }

  const handleShare = async () => {
    if (selectedMedia.length === 0 && !text) {
      Alert.alert("Empty Story", "Please add media or text to your story")
      return
    }

    console.log("[v0] Creating story with:", { text, mediaCount: selectedMedia.length })

    Alert.alert("Success", "Story shared successfully!")

    reset()
    setMediaAssets([])
    router.back()
  }

  const currentMedia = selectedMedia[currentIndex]
  const currentMediaType = mediaTypes[currentIndex]

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-black">
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border/20 px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <X size={24} color="white" />
          </Pressable>
          <Text className="text-lg font-semibold text-white">Create Story</Text>
          <Pressable onPress={handleShare}>
            <Text className="font-semibold text-primary">Share</Text>
          </Pressable>
        </View>

        {/* Story Canvas */}
        <View className="flex-1 items-center justify-center p-4">
          <View
            className="relative overflow-hidden rounded-2xl"
            style={{
              width: SCREEN_WIDTH - 32,
              aspectRatio: 9 / 16,
              maxHeight: Dimensions.get("window").height - 240,
            }}
          >
            {/* Background */}
            {!currentMedia && backgroundColor && (
              <LinearGradient
                colors={(() => {
                  const matches = backgroundColor.match(/#[0-9A-F]{6}/gi)
                  if (matches && matches.length >= 2) {
                    return matches as [string, string]
                  }
                  const color = matches?.[0] || "#000000"
                  return [color, color] as [string, string]
                })()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            )}

            {/* Media Content */}
            {currentMedia && (
              <>
                {currentMediaType === "video" ? (
                  <View className="h-full w-full bg-black">
                    <Text className="p-4 text-center text-white">Video: {currentMedia}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: currentMedia }} className="h-full w-full" contentFit="cover" />
                )}
              </>
            )}

            {/* Text Overlay or Input */}
            {!currentMedia ? (
              <View className="absolute inset-0 items-center justify-center p-8">
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Type something..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  multiline
                  maxLength={300}
                  className="w-full text-center text-2xl font-bold"
                  style={{ color: textColor }}
                />
              </View>
            ) : (
              text && (
                <View className="absolute bottom-8 left-0 right-0 px-8">
                  <Text className="text-center text-xl font-bold" style={{ color: textColor }}>
                    {text}
                  </Text>
                </View>
              )
            )}

            {/* Navigation for multiple media */}
            {selectedMedia.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <Pressable
                    onPress={prevSlide}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2"
                  >
                    <ChevronLeft size={24} color="white" />
                  </Pressable>
                )}
                {currentIndex < selectedMedia.length - 1 && (
                  <Pressable
                    onPress={nextSlide}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2"
                  >
                    <ChevronRight size={24} color="white" />
                  </Pressable>
                )}
                {/* Progress indicators */}
                <View className="absolute left-0 right-0 top-2 flex-row gap-1 px-2">
                  {selectedMedia.map((_, idx) => (
                    <View
                      key={idx}
                      className="h-0.5 flex-1 rounded-full"
                      style={{ backgroundColor: idx === currentIndex ? "white" : "rgba(255,255,255,0.3)" }}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Tools */}
        <View className="border-t border-border/20 px-4 py-4">
          <View className="flex-row items-center justify-center gap-6">
            <Pressable
              onPress={() => setShowMediaPicker(true)}
              disabled={selectedMedia.length >= 4}
              className="items-center gap-1"
              style={{ opacity: selectedMedia.length >= 4 ? 0.3 : 1 }}
            >
              <ImageIcon size={28} color="white" />
              <Text className="text-xs text-white">
                Image {selectedMedia.length > 0 && `(${selectedMedia.length}/4)`}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowMediaPicker(true)}
              disabled={selectedMedia.length >= 4}
              className="items-center gap-1"
              style={{ opacity: selectedMedia.length >= 4 ? 0.3 : 1 }}
            >
              <Video size={28} color="white" />
              <Text className="text-xs text-white">Video</Text>
            </Pressable>

            <Pressable onPress={() => setText("")} className="items-center gap-1">
              <Type size={28} color="white" />
              <Text className="text-xs text-white">Text</Text>
            </Pressable>
          </View>

          {/* Background Color Picker - only show when no media */}
          {selectedMedia.length === 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
              <View className="flex-row gap-2 px-4">
                {bgGradients.map((gradient, index) => (
                  <Pressable
                    key={index}
                    onPress={() =>
                      setBackgroundColor(
                        `linear-gradient(135deg, ${gradient.colors[0]} 0%, ${gradient.colors[1]} 100%)`,
                      )
                    }
                    className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/20"
                  >
                    <LinearGradient
                      colors={gradient.colors as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="flex-1"
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Media Picker Modal */}
        {showMediaPicker && (
          <View className="absolute inset-0 bg-black">
            <SafeAreaView edges={["top"]} className="flex-1">
              <View className="flex-row items-center justify-between border-b border-white/20 px-4 py-3">
                <Pressable onPress={() => setShowMediaPicker(false)}>
                  <X size={24} color="#fff" />
                </Pressable>
                <Text className="text-lg font-semibold text-white">Select Media ({selectedMedia.length}/4)</Text>
                <View style={{ width: 24 }} />
              </View>
              <MediaPickerNative selectedMedia={mediaAssets} onMediaSelected={handleMediaSelected} maxSelection={4} />
            </SafeAreaView>
          </View>
        )}
      </Main>
    </SafeAreaView>
  )
}
