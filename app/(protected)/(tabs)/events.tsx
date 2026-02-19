import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
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
  CalendarOff,
  SearchX,
  SlidersHorizontal,
  PartyPopper,
  History,
  Map,
  List,
} from "lucide-react-native";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useIsLargeScreen } from "@/lib/hooks/use-is-large-screen";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useRef, useCallback, useMemo, useEffect } from "react";
import { Debouncer } from "@tanstack/react-pacer";
import { EventCardSkeleton } from "@/components/skeletons";
import { PagerViewWrapper } from "@/components/ui/pager-view";
import {
  useEvents,
  useForYouEvents,
  eventKeys,
  type Event,
  type EventFilters,
} from "@/lib/hooks/use-events";
import { eventsApi } from "@/lib/api/events";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { useScreenTrace } from "@/lib/perf/screen-trace";
import { useBootstrapEvents } from "@/lib/hooks/use-bootstrap-events";
import { useEventsLocationStore } from "@/lib/stores/events-location-store";
import { useEventsScreenStore } from "@/lib/stores/events-screen-store";
import { CityPickerSheet } from "@/components/events/city-picker-sheet";
import { WeatherStrip } from "@/components/events/weather-strip";
import { useCities } from "@/lib/hooks/use-cities";
import { FilterPills } from "@/components/events/filter-pills";
import { EventCollectionRow } from "@/components/events/event-collection-row";
import { EventsMapView } from "@/components/events/events-map-view";

function EventCard({
  event,
  index,
  scrollY,
  colors,
  router,
  formatLikes,
  cardWidth,
  cardHeight,
  compact,
  queryClient,
}: {
  event: Event;
  index: number;
  scrollY: any;
  colors: any;
  router: any;
  formatLikes: (likes: number) => string;
  cardWidth: number;
  cardHeight: number;
  compact?: boolean;
  queryClient: any;
}) {
  const animatedImageStyle = useAnimatedStyle(() => {
    "worklet";
    const translateY = (scrollY.value - index * (cardHeight + 20)) * -0.15;
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
          onPressIn={() => {
            queryClient.prefetchQuery({
              queryKey: eventKeys.detail(event.id),
              queryFn: () => eventsApi.getEventById(event.id),
              staleTime: 5 * 60 * 1000,
            });
          }}
          onPress={() => router.push(`/(protected)/events/${event.id}` as any)}
        >
          <View style={{ height: cardHeight }} className="w-full">
            {/* Parallax image layer */}
            <Animated.View
              style={[
                {
                  width: "100%",
                  height: cardHeight + 100,
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
            <Animated.View
              className="absolute bottom-0 left-0 right-0"
              style={{ padding: compact ? 16 : 24 }}
            >
              <View className="bg-white/20 px-3 py-1.5 rounded-xl self-start mb-2">
                <Text className="text-white text-xs font-medium">
                  {event.category}
                </Text>
              </View>
              <Text
                className={`text-white font-bold ${compact ? "text-lg mb-1" : "text-[28px] mb-2"}`}
                numberOfLines={compact ? 1 : 2}
              >
                {event.title}
              </Text>
              <Text
                className={`text-white/80 ${compact ? "text-xs mb-2" : "text-sm mb-4"}`}
              >
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
                            size={compact ? 24 : 32}
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
  const queryClient = useQueryClient();
  const pagerRef = useRef<any>(null);
  const trace = useScreenTrace("Events");
  useBootstrapEvents();

  // Responsive grid — 2-col on tablet
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = useIsLargeScreen();
  const numColumns = isLargeScreen ? 2 : 1;
  const gridGap = isLargeScreen ? 12 : 0;
  const cardWidth = isLargeScreen
    ? (Math.min(screenWidth, 768) - 32 - gridGap) / 2
    : screenWidth - 12;
  const cardHeight = Math.round(cardWidth * (isLargeScreen ? 0.85 : 1));

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
  const showMapView = useEventsScreenStore((s) => s.showMapView);
  const toggleMapView = useEventsScreenStore((s) => s.toggleMapView);
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

  // "For You" personalized feed (separate query, 15min cache)
  const { data: forYouEvents = [], isLoading: forYouLoading } =
    useForYouEvents();

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

  // Filter events by tab — server handles pill filters
  // Tab indices: 0=For You, 1=All Events, 2=Upcoming, 3=Past
  const getFilteredEvents = useCallback(
    (tabIndex: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (tabIndex) {
        case 0: // For You
          return forYouEvents;
        case 2: // upcoming
          return events.filter(
            (event: Event) =>
              event.fullDate && new Date(event.fullDate) >= today,
          );
        case 3: // past_events
          return events.filter(
            (event: Event) =>
              event.fullDate && new Date(event.fullDate) < today,
          );
        default: // All Events (1)
          return events;
      }
    },
    [events, forYouEvents],
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
    { key: "for_you", label: "For You" },
    { key: "all_events", label: "All Events" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past_events", label: "Past Events" },
  ];

  // Compute curated collections from existing events
  const collections = useMemo(() => {
    if (events.length === 0) return { weekend: [], trending: [], fresh: [] };
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const satStart = new Date(now);
    satStart.setDate(now.getDate() + ((6 - dayOfWeek + 7) % 7));
    satStart.setHours(0, 0, 0, 0);
    const sunEnd = new Date(satStart);
    sunEnd.setDate(satStart.getDate() + 1);
    sunEnd.setHours(23, 59, 59, 999);

    const weekend = events.filter((e: Event) => {
      if (!e.fullDate) return false;
      const d = new Date(e.fullDate);
      return d >= satStart && d <= sunEnd;
    });

    const trending = [...events]
      .sort(
        (a: Event, b: Event) =>
          (b.totalAttendees ?? 0) - (a.totalAttendees ?? 0),
      )
      .slice(0, 6);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fresh = events
      .filter((e: Event) => {
        if (!e.fullDate) return false;
        return new Date(e.fullDate) >= now;
      })
      .slice(0, 6);

    return { weekend, trending, fresh };
  }, [events]);

  const showCollections =
    debouncedSearch.length < 2 && activeFilters.length === 0;

  // Whether events are still loading (show inline skeletons, never block layout)
  const showEventSkeletons = isLoading && events.length === 0;

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
                  onPress={toggleMapView}
                  className="w-full h-full items-center justify-center"
                >
                  {showMapView ? (
                    <List size={18} color={colors.foreground} />
                  ) : (
                    <Map size={18} color={colors.foreground} />
                  )}
                </Pressable>
              </Motion.View>
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

        {showMapView ? (
          <EventsMapView events={events} />
        ) : (
          <>
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
                      debouncedSearch.length >= 2 ? (
                        <EmptyState
                          icon={SearchX}
                          title="No matches"
                          accent="#f97316"
                          description={`Nothing matched "${debouncedSearch}". Try a different keyword or check spelling.`}
                          action={
                            <Pressable
                              onPress={handleClearSearch}
                              className="bg-primary px-6 py-3 rounded-full"
                            >
                              <Text className="text-primary-foreground font-semibold text-sm">
                                Clear Search
                              </Text>
                            </Pressable>
                          }
                        />
                      ) : activeFilters.length > 0 ? (
                        <EmptyState
                          icon={SlidersHorizontal}
                          title="Too filtered"
                          accent="#8b5cf6"
                          description="No events match your current filters. Try removing some to see more."
                          action={
                            <Pressable
                              onPress={() => {
                                activeFilters.forEach((f) => toggleFilter(f));
                              }}
                              className="bg-primary px-6 py-3 rounded-full"
                            >
                              <Text className="text-primary-foreground font-semibold text-sm">
                                Clear Filters
                              </Text>
                            </Pressable>
                          }
                        />
                      ) : tabIndex === 3 ? (
                        <EmptyState
                          icon={History}
                          title="No past events"
                          accent="#6b7280"
                          description="Events you've attended will appear here after they end."
                        />
                      ) : tabIndex === 2 ? (
                        <EmptyState
                          icon={PartyPopper}
                          title="Nothing upcoming"
                          accent="#FF5BFC"
                          description="Be the first to create an event in your area!"
                          action={
                            <Pressable
                              onPress={() =>
                                router.push("/(protected)/events/create" as any)
                              }
                              className="bg-primary px-6 py-3 rounded-full flex-row items-center gap-2"
                            >
                              <Plus size={16} color="#fff" />
                              <Text className="text-primary-foreground font-semibold text-sm">
                                Create Event
                              </Text>
                            </Pressable>
                          }
                        />
                      ) : tabIndex === 0 ? (
                        <EmptyState
                          icon={Heart}
                          title="Your feed is building"
                          accent="#8A40CF"
                          description="Like and RSVP to events to train your personalized feed."
                          action={
                            <Pressable
                              onPress={() => handleTabPress(1)}
                              className="bg-primary px-6 py-3 rounded-full"
                            >
                              <Text className="text-primary-foreground font-semibold text-sm">
                                Browse All Events
                              </Text>
                            </Pressable>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={CalendarOff}
                          title="No events yet"
                          accent="#3FDCFF"
                          description="Check back later or create one to get the party started!"
                          action={
                            <Pressable
                              onPress={() =>
                                router.push("/(protected)/events/create" as any)
                              }
                              className="bg-primary px-6 py-3 rounded-full flex-row items-center gap-2"
                            >
                              <Plus size={16} color="#fff" />
                              <Text className="text-primary-foreground font-semibold text-sm">
                                Create Event
                              </Text>
                            </Pressable>
                          }
                        />
                      )
                    ) : showEventSkeletons ? (
                      <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                          padding: 16,
                          paddingBottom: 32,
                        }}
                      >
                        <EventCardSkeleton />
                        <EventCardSkeleton />
                      </ScrollView>
                    ) : (
                      <Animated.ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                      >
                        {/* Curated collections — only on All Events tab, no search/filters */}
                        {tabIndex === 1 && showCollections && (
                          <View className="pt-4">
                            <EventCollectionRow
                              title="This Weekend"
                              emoji="\uD83C\uDF89"
                              events={collections.weekend}
                            />
                            <EventCollectionRow
                              title="Trending"
                              emoji="\uD83D\uDD25"
                              events={collections.trending}
                            />
                            <EventCollectionRow
                              title="New & Notable"
                              emoji="\u2728"
                              events={collections.fresh}
                            />
                          </View>
                        )}
                        <View
                          style={{
                            paddingHorizontal: 16,
                            flexDirection: isLargeScreen ? "row" : "column",
                            flexWrap: isLargeScreen ? "wrap" : "nowrap",
                            gap: gridGap,
                          }}
                        >
                          {filteredEvents.map((event, index) => (
                            <View
                              key={event.id}
                              style={
                                isLargeScreen ? { width: cardWidth } : undefined
                              }
                            >
                              <EventCard
                                event={event}
                                index={index}
                                scrollY={scrollY}
                                colors={colors}
                                router={router}
                                formatLikes={formatLikes}
                                cardWidth={cardWidth}
                                cardHeight={cardHeight}
                                compact={isLargeScreen}
                                queryClient={queryClient}
                              />
                            </View>
                          ))}
                        </View>
                      </Animated.ScrollView>
                    )}
                  </View>
                );
              })}
            </PagerViewWrapper>
          </>
        )}
      </Main>

      {/* City Picker Bottom Sheet */}
      <CityPickerSheet
        visible={cityPickerVisible}
        onDismiss={() => setCityPickerVisible(false)}
      />
    </View>
  );
}
