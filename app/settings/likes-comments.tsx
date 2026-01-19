
import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export default function LikesCommentsScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const [hideLikeCounts, setHideLikeCounts] = useState(false)
  const [allowComments, setAllowComments] = useState(true)
  const [filterComments, setFilterComments] = useState(true)
  const [manualFilter, setManualFilter] = useState(false)

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Likes and Comments</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">LIKES</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Hide Like Counts</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Hide like counts on posts from others
                </Text>
              </View>
              <Switch checked={hideLikeCounts} onCheckedChange={setHideLikeCounts} />
            </View>
          </View>

          <Text className="mb-3 text-sm font-semibold text-muted-foreground">COMMENTS</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Allow Comments</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Let others comment on your posts
                </Text>
              </View>
              <Switch checked={allowComments} onCheckedChange={setAllowComments} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Filter Offensive Comments</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Hide comments that may be offensive
                </Text>
              </View>
              <Switch checked={filterComments} onCheckedChange={setFilterComments} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Manual Filter</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Hide comments with specific words
                </Text>
              </View>
              <Switch checked={manualFilter} onCheckedChange={setManualFilter} />
            </View>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
