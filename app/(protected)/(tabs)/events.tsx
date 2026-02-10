import { View, Text, Pressable, ScrollView, Dimensions } from "react-native";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import { Heart, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  FadeInDown,
} from "react-native-reanimated";
import { useState, useRef, useCallback, useMemo } from "react";
import { EventsSkeleton } from "@/components/skeletons";
import { PagerViewWrapper } from "@/components/ui/pager-view";
import { useEvents, type Event } from "@/lib/hooks/use-events";
import { Avatar } from "@/components/ui/avatar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 12; // 16px padding each side
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 5)); // 5:4 aspect ratio

function EventCard({
  event,
  index,
  scrollY,
  colors,
  router,
  formatLikes,
}: {
  event: Event;
  index: number;
  scrollY: any;
  colors: any;
  router: any;
  formatLikes: (likes: number) => string;
}) {
  const animatedImageStyle = useAnimatedStyle(() => {
    "worklet";
    const translateY = (scrollY.value - index * (CARD_HEIGHT + 20)) * -0.15;
    return {
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 150)
        .duration(800)
        .springify()}
    >
      <Motion.View
        className="rounded-3xl overflow-hidden mb-5"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        style={{
          shadowColor: "#fff",
          shadowOpacity: 0.2,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 0 },
          elevation: 2,
        }}
      >
        <Pressable
          onPress={() => router.push(`/(protected)/events/${event.id}` as any)}
        >
          <View style={{ height: CARD_HEIGHT }} className="w-full">
            <Animated.View
              style={[
                {
                  width: "100%",
                  height: CARD_HEIGHT + 100,
                  position: "absolute",
                  top: -50,
                },
                animatedImageStyle,
              ]}
            >
              <SharedImage
                sharedTag={`event-hero-${event.id}`}
                source={{ uri: event.image }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </Animated.View>
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]}
              className="absolute inset-0"
            />

            {/* Like Button — top-left */}
            <View className="absolute top-4 left-4">
              <Pressable className="flex-row items-center gap-1.5 bg-black/40 px-4 py-2 rounded-full">
                <Heart size={16} color="#fff" />
                <Text className="text-white text-sm font-medium">
                  {formatLikes(event.likes ?? 0)}
                </Text>
              </Pressable>
            </View>

            {/* Date Badge */}
            <Motion.View
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", delay: index * 0.1 }}
              className="absolute top-4 right-4 bg-background rounded-2xl px-4 py-3 items-center min-w-[70px]"
            >
              <Text className="text-2xl font-bold text-foreground">
                {event.date}
              </Text>
              <Text className="text-[10px] text-muted-foreground uppercase mt-0.5">
                {event.month}
              </Text>
            </Motion.View>

            {/* Event Details */}
            <Animated.View className="absolute bottom-0 left-0 right-0 p-6">
              <View className="bg-white/20 px-3 py-1.5 rounded-xl self-start mb-3">
                <Text className="text-white text-xs font-medium">
                  {event.category}
                </Text>
              </View>
              <Text className="text-white text-[28px] font-bold mb-2">
                {event.title}
              </Text>
              <Text className="text-white/80 text-sm mb-4">
                {event.time} •{" "}
                {(() => {
                  const count = Array.isArray(event.attendees)
                    ? event.attendees.length
                    : event.attendees || 0;
                  return `${count} participant${count === 1 ? "" : "s"}`;
                })()}
              </Text>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  {Array.isArray(event.attendees) ? (
                    event.attendees
                      .slice(0, 3)
                      .map((attendee: any, idx: number) => (
                        <View
                          key={idx}
                          className="border-2 border-background overflow-hidden"
                          style={{
                            marginLeft: idx === 0 ? 0 : -10,
                            borderRadius: 8,
                          }}
                        >
                          <Avatar
                            uri={attendee.image}
                            username={attendee.initials || "??"}
                            size={32}
                            variant="roundedSquare"
                          />
                        </View>
                      ))
                  ) : (
                    <View className="bg-white/20 px-3 py-1.5 rounded-xl">
                      <Text className="text-white text-xs font-medium">
                        {typeof event.attendees === "number"
                          ? event.attendees
                          : 0}{" "}
                        attending
                      </Text>
                    </View>
                  )}
                  {(event.totalAttendees ?? 0) > 3 &&
                    Array.isArray(event.attendees) && (
                      <View className="ml-2 bg-white/20 px-2 py-1 rounded-xl">
                        <Text className="text-white text-xs font-medium">
                          +{(event.totalAttendees ?? 0) - 3}
                        </Text>
                      </View>
                    )}
                </View>
                <View className="bg-primary px-5 py-2 rounded-full">
                  <Text className="text-white text-base font-bold">
                    ${event.price}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </Pressable>
      </Motion.View>
    </Animated.View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef<any>(null);

  // Fetch real events from API
  const { data: events = [], isLoading, error } = useEvents();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const formatLikes = (likes: number) => {
    if (likes >= 1000) {
      return `${(likes / 1000).toFixed(1)}k`;
    }
    return likes.toString();
  };

  // Filter events based on tab index
  const getFilteredEvents = useCallback(
    (tabIndex: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (tabIndex) {
        case 1: // upcoming
          return events.filter(
            (event: Event) =>
              event.fullDate && new Date(event.fullDate) >= today,
          );
        case 2: // past_events
          return events.filter(
            (event: Event) =>
              event.fullDate && new Date(event.fullDate) < today,
          );
        default: // all_events
          return events;
      }
    },
    [events],
  );

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  const handlePageSelected = (e: any) => {
    setActiveTab(e.nativeEvent.position);
  };

  const tabs = [
    { key: "all_events", label: "All Events" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past_events", label: "Past Events" },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <Main className="flex-1">
          <EventsSkeleton />
        </Main>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View>
            <Text className="text-xs uppercase tracking-wide text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text className="text-2xl font-bold text-foreground">Events</Text>
          </View>
          <Motion.View
            whileTap={{ scale: 0.9 }}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            <Pressable
              onPress={() => router.push("/(protected)/events/create" as any)}
              className="w-full h-full items-center justify-center"
            >
              <Plus size={20} color="#fff" />
            </Pressable>
          </Motion.View>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row border-b border-border">
          {tabs.map((tab, index) => (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(index)}
              className={`flex-1 py-3 ${activeTab === index ? "border-b-2 border-primary" : ""}`}
            >
              <Text
                className={`text-center font-medium ${activeTab === index ? "text-primary" : "text-muted-foreground"}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Swipeable Pages */}
        <PagerViewWrapper
          pagerRef={pagerRef}
          style={{ flex: 1 }}
          initialPage={activeTab}
          onPageSelected={handlePageSelected}
        >
          {tabs.map((tab, tabIndex) => {
            const filteredEvents = getFilteredEvents(tabIndex);
            return (
              <View key={tab.key} className="flex-1">
                <View className="px-4 py-2 bg-muted">
                  <Text className="text-sm text-muted-foreground">
                    Showing {filteredEvents.length} events
                  </Text>
                </View>
                <Animated.ScrollView
                  className="flex-1"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 16 }}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                >
                  {filteredEvents.map((event, index) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      index={index}
                      scrollY={scrollY}
                      colors={colors}
                      router={router}
                      formatLikes={formatLikes}
                    />
                  ))}
                </Animated.ScrollView>
              </View>
            );
          })}
        </PagerViewWrapper>
      </Main>
    </View>
  );
}
