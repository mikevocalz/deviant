import { View, Text, TextInput, Pressable, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Search, X } from "lucide-react-native"
import { Image } from "expo-image"
import { useNewMessageStore } from "@/lib/stores/comments-store"
import { useCallback } from "react"

const allUsers = [
  { id: "1", username: "emma_wilson", name: "Emma Wilson", avatar: "https://i.pravatar.cc/150?img=5" },
  { id: "2", username: "john_fitness", name: "John Fitness", avatar: "https://i.pravatar.cc/150?img=17" },
  { id: "3", username: "sarah_artist", name: "Sarah Artist", avatar: "https://i.pravatar.cc/150?img=14" },
  { id: "4", username: "mike_photo", name: "Mike Photo", avatar: "https://i.pravatar.cc/150?img=15" },
  { id: "5", username: "alex_travel", name: "Alex Travel", avatar: "https://i.pravatar.cc/150?img=12" },
  { id: "6", username: "lisa_foodie", name: "Lisa Foodie", avatar: "https://i.pravatar.cc/150?img=9" },
  { id: "7", username: "david_tech", name: "David Tech", avatar: "https://i.pravatar.cc/150?img=11" },
  { id: "8", username: "nina_style", name: "Nina Style", avatar: "https://i.pravatar.cc/150?img=16" },
]

export default function NewMessageScreen() {
  const router = useRouter()
  const { searchQuery, setSearchQuery } = useNewMessageStore()

  const filteredUsers = searchQuery
    ? allUsers.filter(
        (user) =>
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allUsers

  const handleSelectUser = useCallback((userId: string) => {
    router.replace(`/(protected)/chat/${userId}`)
  }, [router])

  const handleProfilePress = useCallback((username: string) => {
    router.push(`/(protected)/profile/${username}`)
  }, [router])

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">New Message</Text>
      </View>

      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center bg-secondary rounded-xl px-3">
          <Search size={20} color="#666" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor="#666"
            autoFocus
            className="flex-1 h-11 ml-2 text-foreground text-base"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <X size={20} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView className="flex-1">
        <Text className="px-4 pt-4 pb-2 text-muted-foreground text-sm font-semibold">
          {searchQuery ? "Search Results" : "Suggested"}
        </Text>
        {filteredUsers.map((user) => (
          <View
            key={user.id}
            className="flex-row items-center gap-3 px-4 py-3"
          >
            <Pressable onPress={() => handleProfilePress(user.username)}>
              <Image source={{ uri: user.avatar }} className="w-[50px] h-[50px] rounded-full" />
            </Pressable>
            <Pressable 
              onPress={() => handleSelectUser(user.id)}
              className="flex-1"
            >
              <Pressable onPress={() => handleProfilePress(user.username)}>
                <Text className="text-base font-semibold text-foreground">{user.username}</Text>
              </Pressable>
              <Text className="text-sm text-muted-foreground">{user.name}</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleSelectUser(user.id)}
              className="bg-primary px-4 py-2 rounded-full"
            >
              <Text className="text-white font-semibold text-sm">Message</Text>
            </Pressable>
          </View>
        ))}
        {filteredUsers.length === 0 && (
          <View className="p-8 items-center">
            <Text className="text-muted-foreground">No users found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
