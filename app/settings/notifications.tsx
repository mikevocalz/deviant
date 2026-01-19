
import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export default function NotificationsScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const [pauseAll, setPauseAll] = useState(false)
  const [likes, setLikes] = useState(true)
  const [comments, setComments] = useState(true)
  const [newFollowers, setNewFollowers] = useState(true)
  const [mentions, setMentions] = useState(true)
  const [directMessages, setDirectMessages] = useState(true)
  const [liveVideos, setLiveVideos] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(false)

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Push Notifications</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Pause All</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Temporarily pause all notifications
                </Text>
              </View>
              <Switch checked={pauseAll} onCheckedChange={setPauseAll} />
            </View>
          </View>

          <Text className="mb-3 text-sm font-semibold text-muted-foreground">INTERACTIONS</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Likes</Text>
              <Switch checked={likes} onCheckedChange={setLikes} disabled={pauseAll} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Comments</Text>
              <Switch checked={comments} onCheckedChange={setComments} disabled={pauseAll} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">New Followers</Text>
              <Switch checked={newFollowers} onCheckedChange={setNewFollowers} disabled={pauseAll} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Mentions</Text>
              <Switch checked={mentions} onCheckedChange={setMentions} disabled={pauseAll} />
            </View>
          </View>

          <Text className="mb-3 text-sm font-semibold text-muted-foreground">MESSAGES</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Direct Messages</Text>
              <Switch checked={directMessages} onCheckedChange={setDirectMessages} disabled={pauseAll} />
            </View>
          </View>

          <Text className="mb-3 text-sm font-semibold text-muted-foreground">OTHER</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Live Videos</Text>
              <Switch checked={liveVideos} onCheckedChange={setLiveVideos} disabled={pauseAll} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <Text className="font-medium text-foreground">Email Notifications</Text>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </View>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
