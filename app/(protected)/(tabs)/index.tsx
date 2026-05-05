import { View, Text, Pressable } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { MasonryFeed } from "@/components/feed/masonry-feed";

import { StoriesBar } from "@/components/stories/stories-bar";
import { useAppStore } from "@/lib/stores/app-store";
import * as Haptics from "expo-haptics";
import { useCallback, memo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * StoriesBar memoized at module level. Rendering it as a sibling of the
 * feed swap (not a child) keeps it MOUNTED across feed-mode toggles and
 * immune to re-renders driven by the feed's own state (nsfwEnabled,
 * feedMode, scroll position, etc.).
 */
const MemoStoriesBar = memo(function MemoStoriesBar() {
  return <StoriesBar />;
});

export const FeedModeToggle = memo(function FeedModeToggle() {
  const nsfwEnabled = useAppStore((s) => s.nsfwEnabled);
  const setNsfwEnabled = useAppStore((s) => s.setNsfwEnabled);

  const toggleSpicy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNsfwEnabled(!nsfwEnabled, "feed_toggle");
  }, [nsfwEnabled, setNsfwEnabled]);

  return (
    <Pressable
      onPress={toggleSpicy}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        gap: 6,
        backgroundColor: nsfwEnabled
          ? "rgba(153,27,27,0.35)"
          : "rgba(255,255,255,0.06)",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: nsfwEnabled
          ? "rgba(239,68,68,0.4)"
          : "rgba(255,255,255,0.08)",
      }}
    >
      <Text style={{ fontSize: 16, lineHeight: 18 }}>
        {nsfwEnabled ? "😈" : "😇"}
      </Text>
      <Text
        style={{
          color: nsfwEnabled ? "rgba(255,100,100,0.9)" : "rgba(255,255,255,0.5)",
          fontSize: 12,
          fontWeight: "600",
        }}
      >
        {nsfwEnabled ? "Spicy" : "Sweet"}
      </Text>
    </Pressable>
  );
});

export default function HomeScreen() {
  const feedMode = useAppStore((s) => s.feedMode);

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: "box-none",
        }}
      >
        <FeedModeToggle />
      </View>
      {/* Sibling of the feed swap — stays mounted across feed-mode toggles
          and the content filter (which only rerenders the feed body). */}
      <View style={{ paddingTop: 40 }}>
        <ErrorBoundary screenName="StoriesBar">
          <MemoStoriesBar />
        </ErrorBoundary>
      </View>
      <Main className="flex-1">
        <ErrorBoundary screenName="Feed">
          {feedMode === "masonry" ? <MasonryFeed /> : <Feed />}
        </ErrorBoundary>
      </Main>
    </View>
  );
}
