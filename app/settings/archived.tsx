import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { useRouter } from "expo-router";
import { ChevronLeft, Archive } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";

export default function ArchivedScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-foreground">
            Archived
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-1 items-center justify-center px-8 py-20">
            <View className="mb-4 rounded-full bg-secondary/50 p-4">
              <Archive size={48} color="#666" />
            </View>
            <Text className="mb-2 text-lg font-semibold text-foreground">
              No Archived Posts
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              When you archive posts, they'll appear here. Only you can see
              archived posts.
            </Text>
          </View>

          <View className="mt-2 px-4 pb-8">
            <View className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Text className="text-center text-sm text-muted-foreground">
                Post archiving is coming soon. You'll be able to hide posts from
                your profile without deleting them.
              </Text>
            </View>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  );
}
