import { View, Text, Pressable, Dimensions, StyleSheet } from "react-native";
import { Section } from "@expo/html-elements";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { StoriesBarSkeleton } from "@/components/skeletons";
import { StoryRing } from "./story-ring";
import InstaStory from "react-native-insta-story";
import type { IUserStory, IUserStoryItem } from "react-native-insta-story";
import { useStories } from "@/lib/hooks/use-stories";
import { useAuthStore } from "@/lib/stores/auth-store";
import { assertAvatarSource } from "@/lib/invariants/assertAvatarOwnership";
import {
  StoryCloseButton,
  StoryHeaderText,
  StoryFooter,
} from "./story-overlays";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function StoriesBar() {
  const router = useRouter();
  const { data: stories = [], isLoading, isPending } = useStories();
  const user = useAuthStore((state) => state.user);

  const handleCreateStory = useCallback(() => {
    router.push("/(protected)/story/create");
  }, [router]);

  // CRITICAL: Find user's own story by userId (author ID), NOT story ID
  // Also filter to only include stories with valid items
  const myStory = useMemo(() => {
    if (!user) return null;
    const userStories = stories.filter(
      (story) =>
        String(story.userId) === String(user.id) &&
        story.items &&
        story.items.length > 0,
    );
    return userStories[0] || null;
  }, [stories, user]);

  const hasMyStory = !!myStory;

  // CRITICAL: Filter out user's own stories from "Other Stories" list
  // Also deduplicate by story ID and group by author
  const otherStories = useMemo(() => {
    if (!user) return stories;

    const filtered = stories.filter(
      (story) =>
        String(story.userId) !== String(user.id) &&
        story.items &&
        story.items.length > 0,
    );

    const seen = new Set<string>();
    const deduped = filtered.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });

    const authorMap = new Map<string, (typeof stories)[0]>();
    for (const story of deduped) {
      const authorKey = story.userId || story.username;
      if (!authorMap.has(authorKey)) {
        authorMap.set(authorKey, story);
      }
    }

    return Array.from(authorMap.values());
  }, [stories, user]);

  // Transform other stories → InstaStory IUserStory[] format
  // CRITICAL: Avatar data comes from entity (story.avatar), NOT authUser
  const instaData: IUserStory[] = useMemo(() => {
    return otherStories.map((story, idx) => {
      // DEV INVARIANT: Ensure avatar comes from entity, not authUser
      if (__DEV__) {
        assertAvatarSource({
          context: "story",
          entityOwnerId: story.userId,
          authUserId: user?.id,
          avatarSource: "entity",
        });
      }

      return {
        user_id: idx,
        user_image: story.avatar || undefined,
        user_name: story.username || "Unknown",
        seen: story.isViewed,
        stories: (story.items || []).map((item: any, itemIdx: number) => {
          const isVideo =
            item.type === "video" &&
            item.url &&
            (item.url.endsWith(".mp4") ||
              item.url.endsWith(".mov") ||
              item.url.includes("video"));

          return {
            story_id: itemIdx,
            story_image: item.url || undefined,
            story_video: isVideo ? item.url : undefined,
            swipeText: "",
            onPress: undefined,
            // Custom data for overlays
            customData: {
              appStoryId: story.id,
              appUserId: story.userId,
              username: story.username,
              avatar: story.avatar,
              itemType: item.type,
              text: item.text,
              textColor: item.textColor,
              backgroundColor: item.backgroundColor,
              duration: item.duration || 5000,
              isYou: false,
              isCloseFriends: story.hasCloseFriendsStory || false,
              visibility: item.visibility || "public",
            },
          } as IUserStoryItem;
        }),
      };
    });
  }, [otherStories, user?.id]);

  const handleStoryStart = useCallback((item?: IUserStory) => {
    console.log("[StoriesBar] Story viewer opened:", item?.user_name);
  }, []);

  const handleStoryClose = useCallback((item?: IUserStory) => {
    console.log("[StoriesBar] Story viewer closed:", item?.user_name);
  }, []);

  const handleStorySeen = useCallback((userSingleStory: any) => {
    console.log(
      "[StoriesBar] Story seen:",
      userSingleStory?.user_name,
      "item:",
      userSingleStory?.story?.story_id,
    );
  }, []);

  // Handle own story press — navigate to existing viewer route
  const handleMyStoryPress = useCallback(() => {
    if (myStory) {
      router.push(`/(protected)/story/${myStory.id}` as any);
    }
  }, [myStory, router]);

  if (isPending) {
    return <StoriesBarSkeleton />;
  }

  return (
    <Section className="border-b border-border">
      <View style={{ height: 120, flexDirection: "row" }}>
        {/* Your Story */}
        <View style={{ paddingVertical: 6, paddingLeft: 4, paddingRight: 10 }}>
          <View className="items-center gap-1.5">
            {hasMyStory && myStory ? (
              <View className="relative">
                {/* Tap story ring to view story */}
                <Pressable onPress={handleMyStoryPress}>
                  {/* CRITICAL: Avatar MUST come from story.avatar (entity data), NOT user.avatar (authUser) */}
                  <StoryRing
                    src={myStory.avatar}
                    alt={myStory.username || "Your story"}
                    hasStory={true}
                    isViewed={myStory.isViewed}
                    isCloseFriends={myStory.hasCloseFriendsStory}
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
                    style={{ height: 80, width: 80 }}
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

        {/* Other Stories — InstaStory handles circle list + fullscreen viewer modal */}
        {instaData.length > 0 && (
          <View style={{ flex: 1 }}>
            <InstaStory
              data={instaData}
              duration={5}
              onStart={handleStoryStart}
              onClose={handleStoryClose}
              onStorySeen={handleStorySeen}
              // ── Avatar circle list styling ──────────────────
              avatarSize={70}
              showAvatarText={true}
              avatarTextStyle={avatarStyles.text}
              avatarImageStyle={avatarStyles.image}
              avatarWrapperStyle={avatarStyles.wrapper}
              unPressedBorderColor="#8A40CF"
              pressedBorderColor="rgba(138, 64, 207, 0.3)"
              unPressedAvatarTextColor="rgba(255,255,255,0.7)"
              pressedAvatarTextColor="rgba(255,255,255,0.4)"
              avatarFlatListProps={{
                showsHorizontalScrollIndicator: false,
                contentContainerStyle: {
                  paddingVertical: 6,
                  paddingRight: 40,
                  gap: 4,
                },
              }}
              style={listContainerStyle.root}
              // ── Fullscreen viewer overrides (CRITICAL) ─────
              // Force true fullscreen: cover, no letterbox, behind status bar
              storyContainerStyle={viewerStyles.container}
              storyImageStyle={viewerStyles.image}
              // ── Progress bar styling ───────────────────────
              animationBarContainerStyle={progressStyles.container}
              loadedAnimationBarStyle={progressStyles.loaded}
              unloadedAnimationBarStyle={progressStyles.unloaded}
              // ── Header styling ─────────────────────────────
              storyUserContainerStyle={headerStyles.container}
              storyAvatarImageStyle={headerStyles.avatar}
              // ── Custom render overrides ────────────────────
              renderCloseComponent={StoryCloseButton}
              renderTextComponent={StoryHeaderText}
              renderSwipeUpComponent={StoryFooter}
            />
          </View>
        )}
      </View>
    </Section>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const listContainerStyle = StyleSheet.create({
  root: {
    flex: 1,
  },
});

const avatarStyles = StyleSheet.create({
  text: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
    maxWidth: 64,
  },
  image: {
    borderRadius: 14,
    width: 74,
    height: 98,
  },
  wrapper: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});

// CRITICAL: Fullscreen media override
// Media renders true fullscreen — extends behind status bar,
// ignores parent padding, no letterboxing. Background: black only.
const viewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 0,
    margin: 0,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    resizeMode: "cover",
  },
});

// Thin, rounded progress bars — Instagram 2025 style
const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingTop: 54,
    paddingHorizontal: 8,
    gap: 4,
  },
  loaded: {
    height: 2.5,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  unloaded: {
    height: 2.5,
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.35)",
    marginHorizontal: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
});

// Header inside the fullscreen viewer
const headerStyles = StyleSheet.create({
  container: {
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  avatar: {
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
});
