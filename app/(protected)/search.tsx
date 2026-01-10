import { View, Text, TextInput, Pressable, ScrollView, Dimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Search, X, Play } from "lucide-react-native"
import { Image } from "expo-image"
import { useSearchStore } from "@/lib/stores/search-store"

const { width } = Dimensions.get("window")
const columnWidth = (width - 8) / 3

const recentSearches = ["nature photography", "travel", "food", "fitness"]
const suggestedUsers = [
  { id: "1", username: "emma_wilson", name: "Emma Wilson", avatar: "https://i.pravatar.cc/150?img=5" },
  { id: "2", username: "john_fitness", name: "John Fitness", avatar: "https://i.pravatar.cc/150?img=17" },
  { id: "3", username: "sarah_artist", name: "Sarah Artist", avatar: "https://i.pravatar.cc/150?img=14" },
]

const searchResults = [
  { id: "1", thumbnail: "https://picsum.photos/seed/post1/400/400", type: "image" },
  { id: "f1", thumbnail: "https://picsum.photos/seed/nature1/400/400", type: "image" },
  { id: "f2", thumbnail: "https://picsum.photos/seed/city1/400/400", type: "image" },
  { id: "f3", thumbnail: "https://picsum.photos/seed/food1/400/400", type: "image" },
  { id: "f4", thumbnail: "https://picsum.photos/seed/fitness1/400/400", type: "image" },
  { id: "f5", thumbnail: "https://picsum.photos/seed/art1/400/400", type: "image" },
  { id: "f6", thumbnail: "https://picsum.photos/seed/travel1/400/400", type: "image" },
  { id: "f7", thumbnail: "https://picsum.photos/seed/tech1/400/400", type: "image" },
  { id: "f8", thumbnail: "https://picsum.photos/seed/fashion1/400/400", type: "image" },
]

export default function SearchScreen() {
  const router = useRouter()
  const { searchQuery, setSearchQuery, clearSearch } = useSearchStore()
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#333", paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#1f1f1f", borderRadius: 12, paddingHorizontal: 12 }}>
          <Search size={20} color="#999" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#999"
            autoFocus
            style={{ flex: 1, height: 40, marginLeft: 8, color: "#fff" }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={clearSearch}>
              <X size={20} color="#999" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {searchQuery.length === 0 ? (
          <>
            {/* Recent Searches */}
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 12, color: "#fff" }}>Recent Searches</Text>
              {recentSearches.map((search, index) => (
                <Pressable
                  key={index}
                  onPress={() => setSearchQuery(search)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}
                >
                  <Search size={18} color="#999" />
                  <Text style={{ marginLeft: 12, color: "#fff" }}>{search}</Text>
                </Pressable>
              ))}
            </View>

            {/* Suggested Users */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#333" }}>
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 12, color: "#fff" }}>Suggested</Text>
              {suggestedUsers.map((user) => (
                <Pressable
                  key={user.id}
                  onPress={() => router.push(`/(protected)/profile/${user.username}` as any)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}
                >
                  <Image source={{ uri: user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontWeight: "600", color: "#fff" }}>{user.username}</Text>
                    <Text style={{ color: "#999", fontSize: 13 }}>{user.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={{ padding: 16, color: "#999" }}>Results for "{searchQuery}"</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/(protected)/post/${item.id}`)}
                  style={{ width: columnWidth, height: columnWidth }}
                >
                  <View style={{ flex: 1, margin: 1, overflow: "hidden", backgroundColor: "#1a1a1a" }}>
                    <Image source={{ uri: item.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    {item.type === "video" && (
                      <View style={{ position: "absolute", top: 8, right: 8 }}>
                        <Play size={20} color="#fff" fill="#fff" />
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
