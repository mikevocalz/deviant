import { View, Text } from "react-native";
import { Main } from "@expo/html-elements";
import { Feed } from "@/components/feed/feed";
import { Component, ErrorInfo, ReactNode } from "react";

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

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        <ErrorBoundary>
          <Feed />
        </ErrorBoundary>
      </Main>
    </View>
  );
}
