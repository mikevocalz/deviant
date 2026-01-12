import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft, Archive, Image as ImageIcon, Video } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

const archivedPosts: { id: string; type: "image" | "video"; thumbnail: string; date: string }[] = []

export default function ArchivedScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Archived</Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {archivedPosts.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 rounded-full bg-secondary/50 p-4">
                <Archive size={48} color="#666" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-foreground">No Archived Posts</Text>
              <Text className="text-center text-sm text-muted-foreground">
                When you archive posts, they'll appear here. Only you can see archived posts.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap p-1">
              {archivedPosts.map((post) => (
                <Pressable
                  key={post.id}
                  className="w-1/3 p-1"
                >
                  <View className="aspect-square rounded-lg bg-secondary">
                    <View className="absolute right-2 top-2">
                      {post.type === "video" ? (
                        <Video size={16} color="#fff" />
                      ) : (
                        <ImageIcon size={16} color="#fff" />
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View className="mt-6 px-4 pb-8">
            <Text className="text-center text-xs text-muted-foreground">
              Archived posts are automatically deleted after 30 days.
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
