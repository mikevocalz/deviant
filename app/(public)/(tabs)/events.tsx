import { View, Text, RefreshControl } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { ErrorBoundary } from "@/components/error-boundary";
import { EventCard } from "@/components/event-card";
import { PublicBrowseBanner } from "@/components/access/PublicBrowseBanner";
import { EventCardSkeleton } from "@/components/skeletons";
import { useEvents } from "@/lib/hooks/use-events";
import { usePublicGateStore } from "@/lib/stores/public-gate-store";

function formatLikes(likes: number) {
  if (likes >= 1000) return `${(likes / 1000).toFixed(1)}k`;
  return String(likes);
}

export default function PublicEventsScreen() {
  const scrollY = useSharedValue(0);
  const openGate = usePublicGateStore((s) => s.openGate);
  const { data: events = [], isLoading, isRefetching, refetch, error } =
    useEvents({ sort: "soonest" });

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  if (isLoading && events.length === 0) {
    return (
      <View className="flex-1 bg-background px-4 pt-4">
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-white text-base font-semibold">
          Failed to load events
        </Text>
        <Text className="text-white/60 text-sm text-center mt-2">
          Pull to refresh and try again.
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary screenName="PublicEvents">
      <Animated.ScrollView
        className="flex-1 bg-background"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#fff"
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <PublicBrowseBanner variant="events" />
        {events.slice(0, 12).map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index}
            scrollY={scrollY}
            formatLikes={formatLikes}
            guestMode
            onRequireAuth={openGate}
          />
        ))}
      </Animated.ScrollView>
    </ErrorBoundary>
  );
}
