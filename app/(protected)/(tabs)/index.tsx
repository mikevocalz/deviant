import { View, Text, Pressable } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { MasonryFeed } from "@/components/feed/masonry-feed";
import { SpicyToggleFAB } from "@/components/spicy-toggle-fab";
import { useAppStore } from "@/lib/stores/app-store";
import { LayoutGrid, List } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/lib/hooks";
import * as Haptics from "expo-haptics";
import { Component, ErrorInfo, ReactNode, useCallback } from "react";

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

function FeedModeFAB() {
  const feedMode = useAppStore((s) => s.feedMode);
  const setFeedMode = useAppStore((s) => s.setFeedMode);
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();

  const toggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFeedMode(feedMode === "classic" ? "masonry" : "classic");
  }, [feedMode, setFeedMode]);

  return (
    <Pressable
      onPress={toggle}
      hitSlop={12}
      style={{
        position: "absolute",
        bottom: insets.bottom + 66,
        right: 16,
        zIndex: 50,
        elevation: 50,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgb(20, 20, 20)",
        borderWidth: 1,
        borderColor: "rgb(38, 38, 38)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }}
    >
      {feedMode === "classic" ? (
        <LayoutGrid size={18} color={colors.foreground} />
      ) : (
        <List size={18} color={colors.foreground} />
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const feedMode = useAppStore((s) => s.feedMode);

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <Main className="flex-1">
        <ErrorBoundary>
          {feedMode === "masonry" ? <MasonryFeed /> : <Feed />}
        </ErrorBoundary>
      </Main>
      <FeedModeFAB />
      <SpicyToggleFAB />
    </View>
  );
}
