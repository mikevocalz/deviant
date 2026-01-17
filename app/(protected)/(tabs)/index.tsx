import { View } from "react-native"
import { Main } from "@expo/html-elements"
import { Feed } from "@/components/feed/feed"

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        <Feed />
      </Main>
    </View>
  )
}
