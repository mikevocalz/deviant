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
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        gap: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: "#1a1a1a", 
        paddingHorizontal: 16, 
        paddingVertical: 12 
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: "#fff" }}>New Message</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" }}>
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          backgroundColor: "#1a1a1a", 
          borderRadius: 12, 
          paddingHorizontal: 12 
        }}>
          <Search size={20} color="#666" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor="#666"
            autoFocus
            style={{ flex: 1, height: 44, marginLeft: 8, color: "#fff", fontSize: 16 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <X size={20} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Text style={{ 
          paddingHorizontal: 16, 
          paddingTop: 16, 
          paddingBottom: 8, 
          color: "#666", 
          fontSize: 14, 
          fontWeight: "600" 
        }}>
          {searchQuery ? "Search Results" : "Suggested"}
        </Text>
        {filteredUsers.map((user) => (
          <View
            key={user.id}
            style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              gap: 12, 
              paddingHorizontal: 16, 
              paddingVertical: 12 
            }}
          >
            <Pressable onPress={() => handleProfilePress(user.username)}>
              <Image source={{ uri: user.avatar }} style={{ width: 50, height: 50, borderRadius: 25 }} />
            </Pressable>
            <Pressable 
              onPress={() => handleSelectUser(user.id)}
              style={{ flex: 1 }}
            >
              <Pressable onPress={() => handleProfilePress(user.username)}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{user.username}</Text>
              </Pressable>
              <Text style={{ fontSize: 14, color: "#666" }}>{user.name}</Text>
            </Pressable>
            <Pressable 
              onPress={() => handleSelectUser(user.id)}
              style={{
                backgroundColor: "#3EA4E5",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Message</Text>
            </Pressable>
          </View>
        ))}
        {filteredUsers.length === 0 && (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#666" }}>No users found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
