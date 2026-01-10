import { View, Text, Pressable, ScrollView } from "react-native"
import { Image } from "expo-image"
import { PlusSquare } from "lucide-react-native"
import { useRouter } from "expo-router"
import { storiesData } from "@/lib/constants"

const yourStory = storiesData[0]
const otherStories = storiesData.slice(1)

export function StoriesBar() {
  const router = useRouter()

  const handleCreateStory = () => {
    router.push("/(protected)/story/create")
  }

  const handleStoryPress = (storyId: string) => {
    router.push(`/(protected)/story/${storyId}`)
  }

  return (
    <View className="border-b border-border">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
        {/* Your Story */}
        <Pressable onPress={handleCreateStory} className="items-center p-2">
          <View className="relative">
            <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-primary">
              <Image source={{ uri: yourStory.avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            </View>
            <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full bg-primary">
              <PlusSquare size={12} color="#fff" />
            </View>
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">Your story</Text>
        </Pressable>

        {/* Other Stories */}
        {otherStories.map((story) => (
          <Pressable key={story.id} onPress={() => handleStoryPress(story.id)} className="items-center p-2">
            <View
              className={`h-16 w-16 items-center justify-center rounded-full border-2 ${
                story.isViewed ? "border-muted" : "border-primary"
              }`}
            >
              <Image source={{ uri: story.avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            </View>
            <Text className="mt-1 max-w-[64px] text-center text-xs text-muted-foreground" numberOfLines={1}>
              {story.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
