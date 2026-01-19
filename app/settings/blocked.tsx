
import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft, UserX } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Image } from "expo-image"

const blockedUsers: { id: string; name: string; username: string; avatar: string }[] = []

export default function BlockedScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Blocked Accounts</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {blockedUsers.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 rounded-full bg-secondary/50 p-4">
                <UserX size={48} color="#666" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-foreground">No Blocked Accounts</Text>
              <Text className="text-center text-sm text-muted-foreground">
                When you block someone, they won't be able to find your profile, posts, or stories.
              </Text>
            </View>
          ) : (
            <View className="px-4 py-4">
              {blockedUsers.map((user) => (
                <View key={user.id} className="mb-3 flex-row items-center rounded-lg border border-border bg-card p-3">
                  <Image
                    source={{ uri: user.avatar }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-foreground">{user.name}</Text>
                    <Text className="text-sm text-muted-foreground">@{user.username}</Text>
                  </View>
                  <Pressable className="rounded-lg bg-secondary px-4 py-2">
                    <Text className="font-semibold text-foreground">Unblock</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
