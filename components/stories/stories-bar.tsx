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
    router.push(`/(protected)/story/${storyId}`)
  }, [router])

  const handleProfilePress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  if (isLoading) {
    return <StoriesBarSkeleton />
  }

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#1a1a1a" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        <Pressable onPress={handleCreateStory} style={{ alignItems: "center", padding: 8 }}>
          <View style={{ position: "relative" }}>
            <View style={{ 
              height: 68, 
              width: 68, 
              alignItems: "center", 
              justifyContent: "center", 
              borderRadius: 34, 
              borderWidth: 2, 
              borderColor: "#3EA4E5" 
            }}>
              <Image source={{ uri: yourStory.avatar }} style={{ width: 60, height: 60, borderRadius: 30 }} />
            </View>
            <View style={{ 
              position: "absolute", 
              bottom: -2, 
              right: -2, 
              height: 24, 
              width: 24, 
              alignItems: "center", 
              justifyContent: "center", 
              borderRadius: 12, 
              backgroundColor: "#3EA4E5",
              borderWidth: 2,
              borderColor: "#000"
            }}>
              <Plus size={14} color="#fff" strokeWidth={3} />
            </View>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, color: "#999" }}>Your story</Text>
        </Pressable>

        {otherStories.map((story) => (
          <View key={story.id} style={{ alignItems: "center", padding: 8 }}>
            <Pressable onPress={() => handleStoryPress(story.id)}>
              <View
                style={{
                  height: 68,
                  width: 68,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 34,
                  borderWidth: 2,
                  borderColor: story.isViewed ? "#333" : "#3EA4E5",
                }}
              >
                <Image source={{ uri: story.avatar }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              </View>
            </Pressable>
            <Pressable onPress={() => handleProfilePress(story.username)}>
              <Text 
                style={{ 
                  marginTop: 6, 
                  maxWidth: 68, 
                  textAlign: "center", 
                  fontSize: 12, 
                  color: "#999" 
                }} 
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
