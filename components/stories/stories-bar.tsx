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
import { assertAvatarSource } from "@/lib/invariants/assertAvatarOwnership";

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

  // CRITICAL: Find user's own story by userId (author ID), NOT story ID
  // Also filter to only include stories with valid items
  const myStory = useMemo(() => {
    if (!user) return null;
    // Find stories where the author (userId) matches the logged-in user
    const userStories = stories.filter(
      (story) =>
        String(story.userId) === String(user.id) &&
        story.items &&
        story.items.length > 0,
    );
    // Return the most recent one (first in array since sorted by createdAt desc)
    return userStories[0] || null;
  }, [stories, user]);

  const hasMyStory = !!myStory;

  // CRITICAL: Filter out user's own stories from "Other Stories" list
  // Also deduplicate by story ID and group by author
  const otherStories = useMemo(() => {
    if (!user) return stories;

    // Filter out current user's stories
    const filtered = stories.filter(
      (story) =>
        String(story.userId) !== String(user.id) &&
        story.items &&
        story.items.length > 0,
    );

    // Deduplicate by story ID
    const seen = new Set<string>();
    const deduped = filtered.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });

    // Group by author - show one story ring per author with their most recent story
    const authorMap = new Map<string, (typeof stories)[0]>();
    for (const story of deduped) {
      const authorKey = story.userId || story.username;
      if (!authorMap.has(authorKey)) {
        authorMap.set(authorKey, story);
      }
    }

    return Array.from(authorMap.values());
  }, [stories, user]);

  if (isLoading) {
    return <StoriesBarSkeleton />;
  }

  return (
    <Section className="border-b border-border">
      <View style={{ height: 154, flexDirection: "row" }}>
        {/* Your Story */}
        <View style={{ paddingVertical: 6, paddingLeft: 4, paddingRight: 10 }}>
          <View className="items-center gap-1.5">
            {hasMyStory && myStory ? (
              <View className="relative">
                {/* Tap story ring to view story */}
                <Pressable onPress={() => handleStoryPress(myStory.id)}>
                  {/* CRITICAL: Avatar MUST come from story.avatar (entity data), NOT user.avatar (authUser) */}
                  {/* Using authUser.avatar here causes cross-user avatar leaks when avatar is updated */}
                  <StoryRing
                    src={myStory.avatar}
                    alt={myStory.username || "Your story"}
                    hasStory={true}
                    isViewed={myStory.isViewed}
                    storyThumbnail={myStory.items?.[0]?.url}
                  />
                </Pressable>
                {/* Add button overlay - tap to add new story */}
                <Pressable
                  onPress={handleCreateStory}
                  className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-primary border-2 border-background"
                >
                  <Plus size={16} color="#0c0a09" strokeWidth={3} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={handleCreateStory}>
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
              </Pressable>
            )}
            <Text
              className="max-w-[64px] text-[9px] font-bold text-muted-foreground"
              numberOfLines={1}
            >
              Your Story
            </Text>
          </View>
        </View>

        {/* Other Stories */}
        <FlatList
          horizontal
          data={otherStories}
          keyExtractor={(item) => `story-${item.id}-${item.userId}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: 6,
            gap: 16,
            paddingRight: 40,
          }}
          style={{ paddingLeft: 10, paddingRight: 40 }}
          renderItem={({ item, index }) => {
            // DEV INVARIANT: Ensure avatar comes from entity, not authUser
            if (__DEV__) {
              assertAvatarSource({
                context: "story",
                entityOwnerId: item.userId,
                authUserId: user?.id,
                avatarSource: "entity",
              });
            }

            return (
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
                  {/* CRITICAL: Avatar MUST come from item.avatar (story author), NOT authUser */}
                  <StoryRing
                    src={item.avatar}
                    alt={item.username}
                    hasStory={true}
                    isViewed={item.isViewed}
                    storyThumbnail={item.items?.[0]?.url}
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
            );
          }}
        />
      </View>
    </Section>
  );
}
