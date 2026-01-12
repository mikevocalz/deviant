import { View, Text, ScrollView, Pressable, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft, Mail, Phone, Calendar, Trash2 } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function AccountScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { user } = useAuthStore()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Account Information</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6 rounded-lg border border-border bg-card p-4">
            <Text className="mb-4 text-lg font-semibold">Personal Information</Text>
            
            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">Name</Text>
              <View className="flex-row items-center rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Text className="flex-1 text-foreground">{user?.name || "Not set"}</Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">Username</Text>
              <View className="flex-row items-center rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Text className="flex-1 text-foreground">@{user?.username || "Not set"}</Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm text-muted-foreground">Email</Text>
              <View className="flex-row items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Mail size={18} color="#666" />
                <Text className="flex-1 text-foreground">{user?.email || "Not set"}</Text>
              </View>
            </View>

            <View>
              <Text className="mb-2 text-sm text-muted-foreground">Phone</Text>
              <View className="flex-row items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <Phone size={18} color="#666" />
                <Text className="flex-1 text-muted-foreground">Not linked</Text>
              </View>
            </View>
          </View>

          <Pressable className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 py-4">
            <Trash2 size={20} color="#ef4444" />
            <Text className="font-semibold text-destructive">Delete Account</Text>
          </Pressable>

          <Text className="mt-4 text-center text-xs text-muted-foreground">
            Deleting your account is permanent and cannot be undone.
          </Text>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
