import { View, Text, TextInput, Pressable, ScrollView, Dimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { ArrowLeft, Search, X, Play } from "lucide-react-native"
import { Image } from "expo-image"
import { useSearchStore } from "@/lib/stores/search-store"
import { useUIStore } from "@/lib/stores/ui-store"
import { useEffect } from "react"
import { SearchSkeleton, SearchResultsSkeleton } from "@/components/skeletons"

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
  const { loadingScreens, setScreenLoading, searchingState, setSearching } = useUIStore()
  const isLoading = loadingScreens.search
  const isSearching = searchingState

  useEffect(() => {
    const loadInitial = async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
      setScreenLoading("search", false)
    }
    loadInitial()
  }, [setScreenLoading])

  useEffect(() => {
    if (searchQuery.length > 0) {
      setSearching(true)
      const timer = setTimeout(() => setSearching(false), 300)
      return () => clearTimeout(timer)
    }
  }, [searchQuery, setSearching])

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <View className="flex-1 flex-row items-center bg-secondary rounded-xl px-3">
          <Search size={20} color="#999" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#999"
            autoFocus
            className="flex-1 h-10 ml-2 text-foreground"
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
        {isLoading ? (
          <SearchSkeleton />
        ) : searchQuery.length === 0 ? (
          <>
            {/* Recent Searches */}
            <View className="p-4">
              <Text className="text-base font-semibold mb-3 text-foreground">Recent Searches</Text>
              {recentSearches.map((search, index) => (
                <Pressable
                  key={index}
                  onPress={() => setSearchQuery(search)}
                  className="flex-row items-center py-2.5"
                >
                  <Search size={18} color="#999" />
                  <Text className="ml-3 text-foreground">{search}</Text>
                </Pressable>
              ))}
            </View>

            {/* Suggested Users */}
            <View className="p-4 border-t border-border">
              <Text className="text-base font-semibold mb-3 text-foreground">Suggested</Text>
              {suggestedUsers.map((user) => (
                <Pressable
                  key={user.id}
                  onPress={() => router.push(`/(protected)/profile/${user.username}` as any)}
                  className="flex-row items-center py-2.5"
                >
                  <Image source={{ uri: user.avatar }} className="w-11 h-11 rounded-full" />
                  <View className="ml-3">
                    <Text className="font-semibold text-foreground">{user.username}</Text>
                    <Text className="text-muted-foreground text-[13px]">{user.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : isSearching ? (
          <SearchResultsSkeleton />
        ) : (
          <View className="flex-1">
            <Text className="p-4 text-muted-foreground">Results for {`"${searchQuery}"`}</Text>
            <View className="flex-row flex-wrap">
              {searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/(protected)/post/${item.id}`)}
                  style={{ width: columnWidth, height: columnWidth }}
                >
                  <View className="flex-1 m-px overflow-hidden bg-secondary">
                    <Image source={{ uri: item.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    {item.type === "video" && (
                      <View className="absolute top-2 right-2">
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
