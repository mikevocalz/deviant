import { View } from "react-native"
import { Main } from "@expo/html-elements"
import { StoriesBar } from "@/components/stories/stories-bar"
import { Feed } from "@/components/feed/feed"

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        <StoriesBar />
        <Feed />
      </Main>
    </View>
  )
}
