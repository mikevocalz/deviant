
import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft, UserPlus, Star } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { Image } from "expo-image"

const closeFriends = [
  { id: "1", name: "Alex Johnson", username: "alexj", avatar: "https://i.pravatar.cc/150?img=1" },
  { id: "2", name: "Sam Wilson", username: "samw", avatar: "https://i.pravatar.cc/150?img=2" },
  { id: "3", name: "Jordan Lee", username: "jordanl", avatar: "https://i.pravatar.cc/150?img=3" },
]

export default function CloseFriendsScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Close Friends</Text>
          <Pressable>
            <UserPlus size={24} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4 py-4">
            <View className="mb-4 flex-row items-center gap-3 rounded-lg bg-primary/10 p-4">
              <Star size={24} color={colors.primary} fill={colors.primary} />
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Close Friends</Text>
                <Text className="text-sm text-muted-foreground">
                  Share stories exclusively with your close friends
                </Text>
              </View>
            </View>
          </View>

          <View className="px-4">
            <Text className="mb-3 text-sm font-semibold text-muted-foreground">
              {closeFriends.length} CLOSE FRIENDS
            </Text>
            
            {closeFriends.map((friend) => (
              <View key={friend.id} className="mb-3 flex-row items-center rounded-lg border border-border bg-card p-3">
                <Image
                  source={{ uri: friend.avatar }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                />
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-foreground">{friend.name}</Text>
                  <Text className="text-sm text-muted-foreground">@{friend.username}</Text>
                </View>
                <Pressable className="rounded-full bg-secondary/50 p-2">
                  <Star size={18} color={colors.primary} fill={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>

          <View className="mt-6 px-4 pb-8">
            <Text className="text-center text-sm text-muted-foreground">
              People won't be notified when you add or remove them from your close friends list.
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
