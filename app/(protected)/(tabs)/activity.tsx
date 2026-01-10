import { View, Text, ScrollView, Pressable } from "react-native"
import { Main } from "@expo/html-elements"
import { Image } from "expo-image"

const activities = [
  {
    id: "1",
    type: "like",
    user: { username: "emma_wilson", avatar: "https://i.pravatar.cc/150?img=5" },
    post: { thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" },
    timeAgo: "2h",
  },
  {
    id: "2",
    type: "comment",
    user: { username: "john_fitness", avatar: "https://i.pravatar.cc/150?img=17" },
    post: { thumbnail: "https://images.unsplash.com/photo-1512621776950-296cd0d26b37?w=800" },
    comment: "Amazing shot!",
    timeAgo: "4h",
  },
  {
    id: "3",
    type: "follow",
    user: { username: "sarah_artist", avatar: "https://i.pravatar.cc/150?img=14" },
    timeAgo: "1d",
  },
  {
    id: "4",
    type: "like",
    user: { username: "mike_photo", avatar: "https://i.pravatar.cc/150?img=15" },
    post: { thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800" },
    timeAgo: "2d",
  },
]

export default function ActivityScreen() {
  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header */}
        <View className="border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Activity</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {activities.map((activity) => (
            <View key={activity.id} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <Image source={{ uri: activity.user.avatar }} className="h-10 w-10 rounded-full" />

              <View className="flex-1">
                <Text className="text-sm text-foreground">
                  <Text className="font-semibold text-foreground">{activity.user.username}</Text>
                  {activity.type === "like" && " liked your post."}
                  {activity.type === "comment" && ` commented: ${activity.comment}`}
                  {activity.type === "follow" && " started following you."}
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">{activity.timeAgo}</Text>
              </View>

              {activity.post && <Image source={{ uri: activity.post.thumbnail }} className="h-12 w-12 rounded-lg" />}

              {activity.type === "follow" && (
                <Pressable className="rounded-lg bg-primary px-4 py-1.5">
                  <Text className="text-sm font-semibold text-primary-foreground">Follow</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      </Main>
    </View>
  )
}
