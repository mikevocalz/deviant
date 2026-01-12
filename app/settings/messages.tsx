import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

export default function MessagesScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const [allowAll, setAllowAll] = useState(false)
  const [messageRequests, setMessageRequests] = useState(true)
  const [groupRequests, setGroupRequests] = useState(true)
  const [readReceipts, setReadReceipts] = useState(true)

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Messages</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-3 text-sm font-semibold text-muted-foreground">WHO CAN MESSAGE YOU</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Allow Messages from Everyone</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Anyone can send you messages directly
                </Text>
              </View>
              <Switch checked={allowAll} onCheckedChange={setAllowAll} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Message Requests</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Receive requests from people you don't follow
                </Text>
              </View>
              <Switch checked={messageRequests} onCheckedChange={setMessageRequests} />
            </View>
            <View className="mx-4 h-px bg-border" />
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Group Requests</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Allow others to add you to group chats
                </Text>
              </View>
              <Switch checked={groupRequests} onCheckedChange={setGroupRequests} />
            </View>
          </View>

          <Text className="mb-3 text-sm font-semibold text-muted-foreground">MESSAGE SETTINGS</Text>
          <View className="mb-6 rounded-lg border border-border bg-card">
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-foreground">Read Receipts</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Show when you've read messages
                </Text>
              </View>
              <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
            </View>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
