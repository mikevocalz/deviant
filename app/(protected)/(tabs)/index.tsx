import { View, Text, Pressable } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { MasonryFeed } from "@/components/feed/masonry-feed";
import {
  SpicyToggleFAB,
  supportsNativeTabsBottomAccessory,
} from "@/components/spicy-toggle-fab";
import { StoriesBar } from "@/components/stories/stories-bar";
import { useAppStore } from "@/lib/stores/app-store";
import { LayoutGrid, List } from "lucide-react-native";
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
  const feedMode = useAppStore((s) => s.feedMode);
  const setFeedMode = useAppStore((s) => s.setFeedMode);

  const setClassic = useCallback(() => {
    if (feedMode !== "classic") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFeedMode("classic");
    }
  }, [feedMode, setFeedMode]);

  const setMasonry = useCallback(() => {
    if (feedMode !== "masonry") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFeedMode("masonry");
    }
  }, [feedMode, setFeedMode]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 3,
        marginVertical: 8,
      }}
    >
      <Pressable
        onPress={setClassic}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 8,
          backgroundColor:
            feedMode === "classic" ? "rgba(255,255,255,0.12)" : "transparent",
        }}
      >
        <List
          size={14}
          color={feedMode === "classic" ? "#fff" : "rgba(255,255,255,0.4)"}
        />
        <Text
          style={{
            color: feedMode === "classic" ? "#fff" : "rgba(255,255,255,0.4)",
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          Feed
        </Text>
      </Pressable>
      <Pressable
        onPress={setMasonry}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 8,
          backgroundColor:
            feedMode === "masonry" ? "rgba(255,255,255,0.12)" : "transparent",
        }}
      >
        <LayoutGrid
          size={14}
          color={feedMode === "masonry" ? "#fff" : "rgba(255,255,255,0.4)"}
        />
        <Text
          style={{
            color: feedMode === "masonry" ? "#fff" : "rgba(255,255,255,0.4)",
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          Grid
        </Text>
      </Pressable>
    </View>
  );
});

export default function HomeScreen() {
  const feedMode = useAppStore((s) => s.feedMode);
  const shouldRenderScreenFab = !supportsNativeTabsBottomAccessory();

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          alignItems: "center",
          pointerEvents: "box-none",
        }}
      >
        <FeedModeToggle />
      </View>
      {/* Sibling of the feed swap — stays mounted across feed-mode toggles
          and the spicy toggle (which only rerenders the feed body). */}
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
      {shouldRenderScreenFab ? <SpicyToggleFAB /> : null}
    </View>
  );
}
