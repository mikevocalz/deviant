import { View, Text, Pressable, ScrollView } from "react-native"
import { Image } from "expo-image"
import { Plus } from "lucide-react-native"
import { useRouter } from "expo-router"
import { storiesData } from "@/lib/constants"
import { useCallback, useState, useEffect } from "react"
import { StoriesBarSkeleton } from "@/components/skeletons"

const yourStory = storiesData[0]
const otherStories = storiesData.slice(1)

export function StoriesBar() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStories = async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
      setIsLoading(false)
    }
    loadStories()
  }, [])

  const handleCreateStory = useCallback(() => {
    router.push("/(protected)/story/create")
  }, [router])

  const handleStoryPress = useCallback((storyId: string) => {
    console.log("[Stories] Navigating to story:", storyId)
    router.push(`/(protected)/story/${storyId}`)
  }, [router])

  const handleProfilePress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  if (isLoading) {
    return <StoriesBarSkeleton />
  }

  return (
    <View className="border-b border-border">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-2">
        <Pressable onPress={handleCreateStory} className="items-center p-2">
          <View className="relative">
            <View className="h-[108px] aspect-video w-[68px] items-center justify-center rounded-sm border-2 border-primary">
              <Image source={{ uri: yourStory.avatar }} className="h-[108px] w-[60px] rounded-sm" />
            </View>
            <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full bg-primary border-2 border-background">
              <Plus size={14} color="#fff" strokeWidth={3} />
            </View>
          </View>
          <Text className="mt-1.5 text-xs text-muted-foreground">Your story</Text>
        </Pressable>

        {otherStories.map((story) => (
          <View key={story.id} className="items-center p-2">
            <Pressable onPress={() => handleStoryPress(story.id)}>
              <View
                className={`h-[108px] aspect-video w-[68px] items-center justify-center rounded-sm border-2 ${
                  story.isViewed ? "border-muted" : "border-primary"
                }`}
              >
                <Image source={{ uri: story.avatar }} className="h-[108px] w-[60px] rounded-sm" />
              </View>
            </Pressable>
            <Pressable onPress={() => handleProfilePress(story.username)}>
              <Text 
                className="mt-1.5 max-w-[68px] text-center text-xs text-muted-foreground"
                numberOfLines={1}
              >
                {story.username}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
