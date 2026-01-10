import { View, Text, TextInput, Pressable, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { useProfileStore } from "@/lib/stores/profile-store"

export default function EditProfileScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { editName, editBio, editWebsite, setEditName, setEditBio, setEditWebsite } = useProfileStore()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold">Edit profile</Text>
        <Pressable onPress={() => router.back()} className="rounded-full bg-primary px-4 py-2">
          <Text className="font-semibold text-primary-foreground">Save</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell people about you"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 120 }}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Website</Text>
            <TextInput
              value={editWebsite}
              onChangeText={setEditWebsite}
              placeholder="https://"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
