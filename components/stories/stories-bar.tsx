import { View, Text, Pressable, FlatList } from "react-native";
import { Section } from "@expo/html-elements";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { StoriesBarSkeleton } from "@/components/skeletons";
import { StoryRing } from "./story-ring";
import { Motion } from "@legendapp/motion";
import { useStories } from "@/lib/hooks/use-stories";
import { useAuthStore } from "@/lib/stores/auth-store";

export function StoriesBar() {
  const router = useRouter();
  const { data: stories = [], isLoading } = useStories();
  const user = useAuthStore((state) => state.user);

  const handleCreateStory = useCallback(() => {
    router.push("/(protected)/story/create");
  }, [router]);

  const handleStoryPress = useCallback(
    (storyId: string) => {
      router.push(`/(protected)/story/${storyId}`);
    },
    [router],
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  // Find user's own story
  const myStory = useMemo(() => {
    if (!user) return null;
    return stories.find((story) => story.id === user.id || story.username === user.username);
  }, [stories, user]);

  const hasMyStory = myStory && myStory.stories && myStory.stories.length > 0;

  if (isLoading) {
    return <StoriesBarSkeleton />;
  }

  return (
    <Section className="border-b border-border">
      <View style={{ height: 154, flexDirection: "row" }}>
        {/* Your Story */}
        <View style={{ paddingVertical: 6, paddingLeft: 4, paddingRight: 10 }}>
          <Pressable
            onPress={hasMyStory && myStory ? () => handleStoryPress(myStory.id) : handleCreateStory}
            className="items-center gap-1.5"
          >
            {hasMyStory && myStory ? (
              <StoryRing
                src={user?.avatar || myStory.avatar}
                alt={user?.username || "Your story"}
                hasStory={true}
                isViewed={myStory.isViewed}
              />
            ) : (
              <View className="relative">
                <View
                  className="items-center justify-center rounded-xl border-2 border-border bg-card"
                  style={{ height: 110, width: 80 }}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Plus size={24} color="#0c0a09" strokeWidth={3} />
                  </View>
                </View>
              </View>
            )}
            <Text
              className="max-w-[64px] text-[9px] font-bold text-muted-foreground"
              numberOfLines={1}
            >
              Your Story
            </Text>
          </Pressable>
        </View>

        {/* Other Stories */}
        <FlatList
          horizontal
          data={stories}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: 6,
            gap: 16,
            paddingRight: 40,
          }}
          style={{ paddingLeft: 10, paddingRight: 40 }}
          renderItem={({ item, index }) => (
            <Motion.View
              initial={{ opacity: 0, x: -100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{
                type: "spring",
                damping: 20,
                stiffness: 90,
                delay: index * 0.15,
              }}
            >
              <Pressable
                onPress={() => handleStoryPress(item.id)}
                className="items-center gap-1.5"
              >
                <StoryRing
                  src={item.avatar}
                  alt={item.username}
                  hasStory={true}
                  isViewed={item.isViewed}
                />
                <Pressable onPress={() => handleProfilePress(item.username)}>
                  <Text
                    className="max-w-[64px] text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {item.username}
                  </Text>
                </Pressable>
              </Pressable>
            </Motion.View>
          )}
        />
      </View>
    </Section>
  );
}
