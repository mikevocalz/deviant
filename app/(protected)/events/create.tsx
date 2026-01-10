import { View, Text, TextInput, Pressable, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { useCreateEventStore } from "@/lib/stores/event-store"

export default function CreateEventScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { title, date, time, location, price, setTitle, setDate, setTime, setLocation, setPrice, reset } = useCreateEventStore()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold">Create Event</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Date</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="Jan 17, 2026"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Time</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="6:00 PM"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Lower East Side, NY"
              placeholderTextColor={colors.mutedForeground}
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-muted-foreground">Price</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="$35"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              className="rounded-xl bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <Pressable
            onPress={() => router.back()}
            className="mt-2 items-center rounded-xl bg-primary py-3"
          >
            <Text className="font-semibold text-primary-foreground">Create</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
