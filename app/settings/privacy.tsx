
import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export default function PrivacyScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const [privateAccount, setPrivateAccount] = useState(false)
  const [activityStatus, setActivityStatus] = useState(true)
  const [readReceipts, setReadReceipts] = useState(true)
  const [showLikes, setShowLikes] = useState(true)

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Privacy</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Private Account</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Only approved followers can see your posts
                </Text>
              </View>
              <Switch checked={privateAccount} onCheckedChange={setPrivateAccount} />
            </View>
            
            <View className="mx-4 h-px bg-border" />
            
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Activity Status</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Show when you were last active
                </Text>
              </View>
              <Switch checked={activityStatus} onCheckedChange={setActivityStatus} />
            </View>
            
            <View className="mx-4 h-px bg-border" />
            
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Read Receipts</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Let others know when you've read their messages
                </Text>
              </View>
              <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
            </View>
            
            <View className="mx-4 h-px bg-border" />
            
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Show Likes Count</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Display like counts on your posts
                </Text>
              </View>
              <Switch checked={showLikes} onCheckedChange={setShowLikes} />
            </View>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
