import { View, Text, Pressable } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { MasonryFeed } from "@/components/feed/masonry-feed";

import { StoriesBar } from "@/components/stories/stories-bar";
import { useAppStore } from "@/lib/stores/app-store";
import * as Haptics from "expo-haptics";
import { useCallback, memo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Motion } from "@legendapp/motion";
import { Flame, Sparkles } from "lucide-react-native";

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

  // Pill-shaped toggle with both icon AND label so the header element
  // reads as "this is a feed-mode switch" instead of as a stray emoji.
  // Active state uses fuchsia for spicy, cyan for sweet — both brand
  // tones, with the off-state staying neutral so the active mode pops.
  return (
    <Motion.View
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      <Pressable
        onPress={toggleSpicy}
        accessibilityLabel={
          nsfwEnabled ? "Switch to sweet feed" : "Switch to spicy feed"
        }
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          backgroundColor: nsfwEnabled
            ? "rgba(255,91,252,0.14)"
            : "rgba(63,220,255,0.10)",
          borderColor: nsfwEnabled
            ? "rgba(255,91,252,0.45)"
            : "rgba(63,220,255,0.32)",
        }}
      >
        {nsfwEnabled ? (
          <Flame size={14} color="#FF5BFC" />
        ) : (
          <Sparkles size={14} color="#3FDCFF" />
        )}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.2,
            color: nsfwEnabled ? "#FF5BFC" : "#3FDCFF",
          }}
        >
          {nsfwEnabled ? "Spicy" : "Sweet"}
        </Text>
      </Pressable>
    </Motion.View>
  );
});

export default function HomeScreen() {
  const feedMode = useAppStore((s) => s.feedMode);

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      {/* Header row — spicy toggle right-aligned, matches events header style */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <FeedModeToggle />
      </View>
      {/* Sibling of the feed swap — stays mounted across feed-mode toggles
          and the content filter (which only rerenders the feed body). */}
      <ErrorBoundary screenName="StoriesBar">
        <MemoStoriesBar />
      </ErrorBoundary>
      <Main className="flex-1">
        <ErrorBoundary screenName="Feed">
          {feedMode === "masonry" ? <MasonryFeed /> : <Feed />}
        </ErrorBoundary>
      </Main>
    </View>
  );
}
