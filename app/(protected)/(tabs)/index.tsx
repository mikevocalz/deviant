import { View, Text, Pressable } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { MasonryFeed } from "@/components/feed/masonry-feed";
import { SpicyToggleFAB } from "@/components/spicy-toggle-fab";
import { useAppStore } from "@/lib/stores/app-store";
import { LayoutGrid, List } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Component, ErrorInfo, ReactNode, useCallback, memo } from "react";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[HomeScreen] Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-background p-4">
          <Text className="text-foreground text-lg font-bold mb-2">
            Something went wrong
          </Text>
          <Text className="text-muted-foreground text-center">
            {this.state.error?.message || "Unknown error"}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <Main className="flex-1">
        <ErrorBoundary>
          {feedMode === "masonry" ? <MasonryFeed /> : <Feed />}
        </ErrorBoundary>
      </Main>
      <SpicyToggleFAB />
    </View>
  );
}
