import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Main } from "@expo/html-elements";
import {
  Heart,
  Plus,
  Ticket,
  MapPin,
  ChevronDown,
  Search,
  X,
  ArrowUpDown,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useRef, useCallback, useMemo, useEffect } from "react";
import { Debouncer } from "@tanstack/react-pacer";
import { EventsSkeleton } from "@/components/skeletons";
import { PagerViewWrapper } from "@/components/ui/pager-view";
import {
  useEvents,
  type Event,
  type EventFilters,
} from "@/lib/hooks/use-events";
import { Avatar } from "@/components/ui/avatar";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import { useBootstrapEvents } from "@/lib/hooks/use-bootstrap-events";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import { useEventsScreenStore } from "@/lib/stores/events-screen-store";
import { CityPickerSheet } from "@/components/events/city-picker-sheet";
import { WeatherStrip } from "@/components/events/weather-strip";
import { useCities } from "@/lib/hooks/use-cities";
import { FilterPills } from "@/components/events/filter-pills";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 12; // 16px padding each side
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1); // 1:1 aspect ratio

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
    <Motion.View
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 300,
        delay: index * 0.15,
      }}
      className="max-w-2xl w-full self-center"
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
            {/* Parallax image layer */}
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
              <Image
                source={{ uri: event.image }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
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
    </Motion.View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<any>(null);
  const trace = useScreenTrace("Events");
  useBootstrapEvents();

  // Zustand store — replaces all useState
  const activeTab = useEventsScreenStore((s) => s.activeTab);
  const setActiveTab = useEventsScreenStore((s) => s.setActiveTab);
  const activeFilters = useEventsScreenStore((s) => s.activeFilters);
  const toggleFilter = useEventsScreenStore((s) => s.toggleFilter);
  const activeSort = useEventsScreenStore((s) => s.activeSort);
  const cycleSort = useEventsScreenStore((s) => s.cycleSort);
  const searchQuery = useEventsScreenStore((s) => s.searchQuery);
  const setSearchQuery = useEventsScreenStore((s) => s.setSearchQuery);
  const debouncedSearch = useEventsScreenStore((s) => s.debouncedSearch);
  const setDebouncedSearch = useEventsScreenStore((s) => s.setDebouncedSearch);
  const cityPickerVisible = useEventsScreenStore((s) => s.cityPickerVisible);
  const setCityPickerVisible = useEventsScreenStore(
    (s) => s.setCityPickerVisible,
  );

  // TanStack Debouncer for search — 400ms delay prevents query-per-keystroke
  const searchDebouncerRef = useRef(
    new Debouncer(
      (q: string) => {
        setDebouncedSearch(q);
      },
      { wait: 400 },
    ),
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      searchDebouncerRef.current.maybeExecute(text);
    },
    [setSearchQuery],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    searchDebouncerRef.current.cancel();
  }, [setSearchQuery, setDebouncedSearch]);

  // Location store
  const activeCity = useEventsLocationStore((s) => s.activeCity);
  const setActiveCity = useEventsLocationStore((s) => s.setActiveCity);
  const deviceLat = useEventsLocationStore((s) => s.deviceLat);
  const deviceLng = useEventsLocationStore((s) => s.deviceLng);
  const { data: allCities = [] } = useCities();

  // Weather coords: prefer active city → device location
  const weatherLat = activeCity?.lat ?? deviceLat ?? undefined;
  const weatherLng = activeCity?.lng ?? deviceLng ?? undefined;

  // Fallback: if boot location hook didn't resolve a city yet,
  // debounce 2s then set first DB city or reverse-geocode from device coords
  const cityFallbackRef = useRef(
    new Debouncer(
      async () => {
        const store = useEventsLocationStore.getState();
        if (store.activeCity) return; // boot hook resolved in time

        // Option A: DB cities available
        const cities = allCities;
        if (cities.length > 0) {
          console.log("[Events] Fallback to first DB city:", cities[0].name);
          store.setActiveCity(cities[0]);
          return;
        }

        // Option B: device coords exist — reverse geocode
        const { deviceLat: lat, deviceLng: lng } = store;
        if (lat != null && lng != null) {
          try {
            const Location = await import("expo-location");
            const [geo] = await Location.reverseGeocodeAsync({
              latitude: lat,
              longitude: lng,
            });
            if (geo?.city) {
              console.log("[Events] Fallback reverse geocode:", geo.city);
              store.setActiveCity({
                id: -1,
                name: geo.city,
                state: geo.region ?? null,
                country: geo.country ?? "US",
                lat,
                lng,
                timezone: null,
                slug: geo.city.toLowerCase().replace(/\s+/g, "-"),
              });
            }
          } catch (e) {
            console.warn("[Events] Fallback geocode failed:", e);
          }
        }
      },
      { wait: 2000 },
    ),
  );

  useEffect(() => {
    if (activeCity) return;
    cityFallbackRef.current.maybeExecute();
    return () => cityFallbackRef.current.cancel();
  }, [activeCity, allCities]);

  // Build server-side filters from active pills + debounced search
  const eventFilters = useMemo<EventFilters>(() => {
    const f: EventFilters = {};
    if (activeFilters.includes("online")) f.online = true;
    if (activeFilters.includes("tonight")) f.tonight = true;
    if (activeFilters.includes("this_weekend")) f.weekend = true;
    if (debouncedSearch.length >= 2) f.search = debouncedSearch;
    if (activeSort !== "soonest") f.sort = activeSort;
    return f;
  }, [activeFilters, debouncedSearch, activeSort]);

  // Fetch events via single batch RPC with server-side filters
  const { data: events = [], isLoading, error } = useEvents(eventFilters);

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

  const handleToggleFilter = useCallback(
    (filter: Parameters<typeof toggleFilter>[0]) => {
      toggleFilter(filter);
    },
    [toggleFilter],
  );

  // Filter events by tab (upcoming/past) — server handles pill filters
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
        default:
          return events;
      }
    },
    [events],
  );

  const handleTabPress = useCallback(
    (index: number) => {
      setActiveTab(index);
      pagerRef.current?.setPage(index);
    },
    [setActiveTab],
  );

  const handlePageSelected = useCallback(
    (e: any) => {
      setActiveTab(e.nativeEvent.position);
    },
    [setActiveTab],
  );

  const tabs = [
    { key: "all_events", label: "All Events" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past_events", label: "Past Events" },
  ];

  // Skeleton ONLY when truly no data (first ever boot, no cache)
  // With MMKV persistence, cache-hit means zero skeleton on cold start
  if (isLoading && events.length === 0) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <Main className="flex-1">
          <EventsSkeleton />
        </Main>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <Main className="flex-1">
        {/* Header — Near Me style */}
        <View className="px-4 pt-2 pb-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text className="text-2xl font-bold text-foreground mt-0.5">
                Events
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {/* City Picker trigger */}
              <Pressable
                onPress={() => setCityPickerVisible(true)}
                className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card"
              >
                <MapPin size={14} color="#3EA4E5" strokeWidth={2} />
                <Text
                  className="text-sm font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {activeCity?.name || "All Cities"}
                </Text>
                <ChevronDown
                  size={14}
                  color={colors.mutedForeground}
                  strokeWidth={2}
                />
              </Pressable>
              <Motion.View
                whileTap={{ scale: 0.9 }}
                className="h-10 w-10 items-center justify-center rounded-full bg-card border border-border"
              >
                <Pressable
                  onPress={() =>
                    router.push("/(protected)/events/my-tickets" as any)
                  }
                  className="w-full h-full items-center justify-center"
                >
                  <Ticket size={18} color={colors.foreground} />
                </Pressable>
              </Motion.View>
              <Motion.View
                whileTap={{ scale: 0.9 }}
                className="h-10 w-10 items-center justify-center rounded-full bg-primary"
              >
                <Pressable
                  onPress={() =>
                    router.push("/(protected)/events/create" as any)
                  }
                  className="w-full h-full items-center justify-center"
                >
                  <Plus size={20} color="#fff" />
                </Pressable>
              </Motion.View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 py-2.5">
            <Search size={18} color={colors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search events, venues, hosts..."
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 ml-3 text-sm text-foreground"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClearSearch} hitSlop={8}>
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Weather Strip — shows skeleton while loading, never disappears */}
        <WeatherStrip lat={weatherLat} lng={weatherLng} />

        {/* Filter Pills + Sort */}
        <View className="flex-row items-center">
          <View className="flex-1">
            <FilterPills
              activeFilters={activeFilters}
              onToggle={handleToggleFilter}
            />
          </View>
          <Pressable
            onPress={cycleSort}
            className="flex-row items-center gap-1.5 mr-4 px-3 py-2 rounded-full border border-border bg-card"
          >
            <ArrowUpDown
              size={13}
              color={colors.mutedForeground}
              strokeWidth={2}
            />
            <Text className="text-xs font-semibold text-muted-foreground">
              {
                {
                  soonest: "Soonest",
                  newest: "Newest",
                  popular: "Popular",
                  price_low: "Price ↑",
                  price_high: "Price ↓",
                }[activeSort]
              }
            </Text>
          </Pressable>
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
                {filteredEvents.length === 0 ? (
                  <View className="flex-1 items-center justify-center px-8 gap-3">
                    <Text className="text-lg font-semibold text-muted-foreground">
                      No events found
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                      {activeFilters.length > 0
                        ? "Try removing some filters"
                        : "Check back later for new events"}
                    </Text>
                  </View>
                ) : (
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
                )}
              </View>
            );
          })}
        </PagerViewWrapper>
      </Main>

      {/* City Picker Bottom Sheet */}
      <CityPickerSheet
        visible={cityPickerVisible}
        onDismiss={() => setCityPickerVisible(false)}
      />
    </View>
  );
}
