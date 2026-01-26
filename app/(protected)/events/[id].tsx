import { View, Text, ScrollView, Pressable } from "react-native";
import React, { useState, useEffect } from "react";
import { Image } from "expo-image";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Share2,
  Heart,
  ArrowLeft,
  Check,
  Ticket,
  QrCode,
  Star,
  MessageCircle,
  ChevronRight,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { useEventViewStore } from "@/lib/stores/event-store";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { events } from "@/lib/api-client";
import { useEventReviews, useCreateEventReview } from "@/lib/hooks/use-event-reviews";
import { useEventComments } from "@/lib/hooks/use-event-comments";
import { EventRatingModal } from "@/components/event-rating-modal";
import { StarRatingDisplay } from "react-native-star-rating-widget";
import { shareEvent } from "@/lib/utils/sharing";
import { useUIStore } from "@/lib/stores/ui-store";

const eventsData: Record<string, any> = {
  "lower-east-side-winter-bar-fest": {
    title: "Lower East Side Winter Bar Fest",
    date: "FRI, JAN 17, 2025",
    time: "6:00 PM - 11:00 PM EST",
    location: "Lower East Side, NY",
    price: 35,
    originalPrice: 50,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop",
    totalAttendees: 127,
    ticketsLeft: 44,
    category: "Nightlife",
    description:
      "Join us for the ultimate winter bar crawl through the Lower East Side! Experience the best bars, clubs, and lounges in one unforgettable night. Your ticket includes exclusive drink specials, no cover charges at participating venues, and a commemorative event wristband.",
    venues: ["The Delancey", "Pianos", "Mercury Lounge", "Arlene's Grocery"],
  },
  "brooklyn-jazz-night": {
    title: "Brooklyn Jazz Night",
    date: "SAT, JAN 18, 2025",
    time: "8:00 PM - 12:00 AM EST",
    location: "Brooklyn, NY",
    price: 45,
    originalPrice: 60,
    image:
      "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&h=600&fit=crop",
    totalAttendees: 89,
    ticketsLeft: 32,
    category: "Music",
    description:
      "Experience the best of Brooklyn's jazz scene in one incredible night. Live performances from local and touring artists in intimate venues across the borough.",
    venues: [
      "Blue Note",
      "Smalls Jazz Club",
      "Village Vanguard",
      "Jazz Standard",
    ],
  },
  "rooftop-brunch-experience": {
    title: "Rooftop Brunch Experience",
    date: "SUN, JAN 19, 2025",
    time: "11:00 AM - 3:00 PM EST",
    location: "Manhattan, NY",
    price: 55,
    originalPrice: 75,
    image:
      "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&h=600&fit=crop",
    totalAttendees: 156,
    ticketsLeft: 28,
    category: "Food & Drink",
    description:
      "Elevate your Sunday with breathtaking views and delicious brunch offerings at Manhattan's most exclusive rooftop venues.",
    venues: ["230 Fifth", "The Press Lounge", "Westlight", "Mr. Purple"],
  },
  "tech-networking-mixer": {
    title: "Tech Startup Networking Mixer",
    date: "THU, JAN 23, 2025",
    time: "6:30 PM - 9:30 PM EST",
    location: "SoHo, NY",
    price: 25,
    originalPrice: 40,
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
    totalAttendees: 203,
    ticketsLeft: 67,
    category: "Networking",
    description:
      "Connect with founders, investors, and tech professionals in NYC's startup ecosystem. Great opportunity to expand your network and discover new opportunities.",
    venues: ["WeWork SoHo", "Alley NYC", "General Assembly", "Galvanize"],
  },
  "comedy-show-special": {
    title: "Stand-Up Comedy Show Special",
    date: "FRI, JAN 24, 2025",
    time: "7:00 PM - 10:00 PM EST",
    location: "Greenwich Village, NY",
    price: 30,
    originalPrice: 45,
    image:
      "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=600&fit=crop",
    totalAttendees: 178,
    ticketsLeft: 22,
    category: "Entertainment",
    description:
      "Laugh the night away with NYC's best comedians. Featuring headliners and up-and-coming talent in the heart of Greenwich Village.",
    venues: ["Comedy Cellar", "The Stand", "Gotham Comedy Club", "Caroline's"],
  },
  "art-gallery-opening": {
    title: "Contemporary Art Gallery Opening",
    date: "SAT, JAN 25, 2025",
    time: "5:00 PM - 9:00 PM EST",
    location: "Chelsea, NY",
    price: 20,
    originalPrice: 35,
    image:
      "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&h=600&fit=crop",
    totalAttendees: 94,
    ticketsLeft: 56,
    category: "Art & Culture",
    description:
      "Be among the first to experience groundbreaking contemporary art at Chelsea's newest gallery opening. Complimentary wine and hors d'oeuvres included.",
    venues: ["Gagosian", "David Zwirner", "Pace Gallery", "Hauser & Wirth"],
  },
};

const allAttendees = [
  { name: "Sarah M.", image: "https://i.pravatar.cc/150?img=5" },
  { name: "Mike J.", initials: "MJ", color: "#22c55e" },
  { name: "Emily R.", image: "https://i.pravatar.cc/150?img=9" },
  { name: "David K.", initials: "DK", color: "#f97316" },
  { name: "Jessica L.", image: "https://i.pravatar.cc/150?img=10" },
  { name: "Alex T.", initials: "AT", color: "#06b6d4" },
  { name: "Rachel W.", image: "https://i.pravatar.cc/150?img=16" },
  { name: "Chris B.", initials: "CB", color: "#14b8a6" },
  { name: "Amanda S.", image: "https://i.pravatar.cc/150?img=20" },
  { name: "Tyler N.", initials: "TN", color: "#f59e0b" },
  { name: "Lisa K.", image: "https://i.pravatar.cc/150?img=1" },
  { name: "John D.", initials: "JD", color: "#8b5cf6" },
  { name: "Maria G.", image: "https://i.pravatar.cc/150?img=2" },
  { name: "Steve H.", initials: "SH", color: "#ef4444" },
  { name: "Anna P.", image: "https://i.pravatar.cc/150?img=3" },
  { name: "Ryan M.", initials: "RM", color: "#10b981" },
  { name: "Sophie L.", image: "https://i.pravatar.cc/150?img=4" },
  { name: "Kevin W.", initials: "KW", color: "#f59e0b" },
  { name: "Nina R.", image: "https://i.pravatar.cc/150?img=6" },
  { name: "Tom B.", initials: "TB", color: "#3b82f6" },
  { name: "Grace S.", image: "https://i.pravatar.cc/150?img=7" },
  { name: "Daniel C.", initials: "DC", color: "#ec4899" },
  { name: "Olivia M.", image: "https://i.pravatar.cc/150?img=8" },
  { name: "James H.", initials: "JH", color: "#14b8a6" },
  { name: "Henry T.", image: "https://i.pravatar.cc/150?img=11" },
  { name: "Isabella R.", initials: "IR", color: "#f97316" },
  { name: "Sam K.", image: "https://i.pravatar.cc/150?img=12" },
  { name: "Jordan P.", initials: "JP", color: "#8b5cf6" },
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const eventId = id || "lower-east-side-winter-bar-fest";
  const { isRsvped, toggleRsvp } = useEventViewStore();
  const { getTicketByEventId, hasValidTicket } = useTicketStore();
  const { showToast } = useUIStore();
  const [isAttendeesExpanded, setIsAttendeesExpanded] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [200, 300], [0, 1]),
    };
  });

  const headerBackgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [200, 300], [0, 1]),
    };
  });

  const ticket = getTicketByEventId(eventId);
  const hasTicket = hasValidTicket(eventId) || isRsvped[eventId] || false;
  const { user } = useAuthStore();
  const [eventData, setEventData] = useState<any>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [organizers, setOrganizers] = useState<Array<{ id: string; name?: string; username?: string; avatar?: string }>>([]);

  // Fetch reviews and comments
  const { data: reviews = [], isLoading: isLoadingReviews } = useEventReviews(eventId, 5);
  const { data: comments = [], isLoading: isLoadingComments } = useEventComments(eventId, 5);
  const createReview = useCreateEventReview();

  // Fetch real event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const fetchedEvent = await events.findByID(eventId, 2);
        if (fetchedEvent) {
          setEventData(fetchedEvent);
          
          // Collect all organizers (host + coOrganizer)
          const orgs: Array<{ id: string; name?: string; username?: string; avatar?: string }> = [];
          
          // Add host/organizer
          if (fetchedEvent.host) {
            const host = typeof fetchedEvent.host === "object" ? fetchedEvent.host : { id: fetchedEvent.host };
            orgs.push({
              id: (host as any)?.id || host,
              name: (host as any)?.name,
              username: (host as any)?.username,
              avatar: (host as any)?.avatar,
            });
          }
          
          // Add co-organizer
          if (fetchedEvent.coOrganizer) {
            const coOrg = typeof fetchedEvent.coOrganizer === "object" ? fetchedEvent.coOrganizer : { id: fetchedEvent.coOrganizer };
            orgs.push({
              id: (coOrg as any)?.id || coOrg,
              name: (coOrg as any)?.name,
              username: (coOrg as any)?.username,
              avatar: (coOrg as any)?.avatar,
            });
          }
          
          setOrganizers(orgs);
          
          // Check if current user is organizer (host or co-organizer)
          const isHost = orgs.some(org => org.id === user?.id);
          setIsOrganizer(isHost);
        }
      } catch (error) {
        console.error("[EventDetail] Error fetching event:", error);
        // Fall back to mock data
        setEventData(
          eventsData[eventId] || eventsData["lower-east-side-winter-bar-fest"],
        );
      }
    };
    fetchEvent();
  }, [eventId, user?.id]);

  const event =
    eventData ||
    eventsData[eventId] ||
    eventsData["lower-east-side-winter-bar-fest"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SafeAreaView
        edges={["top"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50 }}
      >
        {/* Animated Background */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.background,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
            headerBackgroundStyle,
          ]}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={24} color="#fff" />
          </Pressable>

          {/* Animated Title */}
          <Animated.Text
            style={[
              {
                flex: 1,
                marginLeft: 12,
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              },
              headerTitleStyle,
            ]}
            numberOfLines={1}
          >
            {event.title}
          </Animated.Text>
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Hero Image */}
        <Animated.View
          // @ts-ignore - sharedTransitionTag is valid but not in types
          sharedTransitionTag={`event-image-${id}`}
          style={{ height: 400, width: "100%" }}
        >
          <Image
            source={{ uri: event.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", colors.background]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 150,
            }}
          />
        </Animated.View>

        {/* Content */}
        <View style={{ padding: 16, marginTop: -60 }}>
          {/* Urgency Banner */}
          <Animated.View
            entering={FadeInDown.delay(100)}
            style={{
              backgroundColor: "rgba(234, 179, 8, 0.2)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <Text style={{ color: "#eab308", fontWeight: "600" }}>
              🔥 Only {event.ticketsLeft} tickets left at this price!
            </Text>
          </Animated.View>

          {/* Title & Actions */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: colors.foreground,
                flex: 1,
                marginRight: 16,
              }}
            >
              {event.title}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Share2 size={20} color={colors.foreground} />
              </Pressable>
              <Pressable
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Heart size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Event Info */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={{ gap: 12, marginBottom: 24 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Calendar size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>
                {event.date}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Clock size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>
                {event.time}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MapPin size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>
                {event.location}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Users size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>
                {event.totalAttendees} attending
              </Text>
            </View>
          </Animated.View>

          {/* Organizers Section */}
          {organizers.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(350)}
              style={{ marginBottom: 24 }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {organizers.length === 1 ? "Organizer" : "Organizers"}
              </Text>
              <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                {organizers.map((org) => (
                  <View
                    key={org.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: colors.card,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          org.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            org.name || org.username || "Organizer",
                          )}`,
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: colors.foreground,
                      }}
                    >
                      {org.name || org.username || "Organizer"}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Referral Banner */}
          <Animated.View
            entering={FadeInDown.delay(400)}
            style={{
              backgroundColor: colors.primary + "20",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: colors.foreground }}>
                Invite friends
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                Share your unique link to get this event jumpin'
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                try {
                  await shareEvent(eventId, event?.title || eventData?.title);
                  showToast("success", "Link Shared", "Event link has been shared!");
                } catch (error) {
                  console.error("[EventDetail] Share error:", error);
                  showToast("error", "Share Failed", "Unable to share event link. Please try again.");
                }
              }}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text
                style={{ color: colors.primaryForeground, fontWeight: "600" }}
              >
                Get Link
              </Text>
            </Pressable>
          </Animated.View>

          {/* About Section */}
          <Animated.View
            entering={FadeInDown.delay(500)}
            style={{ marginBottom: 24 }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              About This Event
            </Text>
            <Text style={{ color: colors.foreground, lineHeight: 24 }}>
              {event.description}
            </Text>
          </Animated.View>

          {/* Venues */}
          <Animated.View
            entering={FadeInDown.delay(600)}
            style={{ marginBottom: 24 }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              Featured Venues
            </Text>
            <View style={{ gap: 12 }}>
              {event.venues.map((venue: string) => (
                <View
                  key={venue}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: colors.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapPin size={24} color={colors.mutedForeground} />
                  </View>
                  <View>
                    <Text
                      style={{ fontWeight: "600", color: colors.foreground }}
                    >
                      {venue}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: colors.mutedForeground }}
                    >
                      Participating venue
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Who's Going */}
          <Animated.View
            entering={FadeInDown.delay(700)}
            style={{ marginBottom: 24 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: colors.foreground,
                }}
              >
                {"Who's Going"}
              </Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
                {event.totalAttendees} attending
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {allAttendees
                  .slice(0, isAttendeesExpanded ? allAttendees.length : 10)
                  .map((attendee, index) => (
                    <Motion.View
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        damping: 20,
                        stiffness: 300,
                        delay: isAttendeesExpanded ? index * 0.05 : 0,
                      }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: attendee.color || "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {attendee.image ? (
                        <Image
                          source={{ uri: attendee.image }}
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <Text
                          style={{
                            color: colors.foreground,
                            fontSize: 14,
                            fontWeight: "600",
                          }}
                        >
                          {attendee.initials}
                        </Text>
                      )}
                    </Motion.View>
                  ))}
                {event.totalAttendees > 10 && !isAttendeesExpanded && (
                  <Pressable
                    onPress={() => setIsAttendeesExpanded(true)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      +{event.totalAttendees - 10}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* See less button when expanded */}
              {isAttendeesExpanded && (
                <Motion.View
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Pressable
                    onPress={() => setIsAttendeesExpanded(false)}
                    style={{ alignSelf: "center" }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.primary,
                        fontWeight: "500",
                      }}
                    >
                      See less
                    </Text>
                  </Pressable>
                </Motion.View>
              )}
            </View>
          </Animated.View>

          {/* Ticket Card */}
          <Animated.View
            entering={FadeInDown.delay(800)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 24,
              marginBottom: 100,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "bold",
                  color: colors.foreground,
                }}
              >
                ${event.price}.00
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                  textDecorationLine: "line-through",
                }}
              >
                ${event.originalPrice}.00
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.muted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                alignSelf: "flex-start",
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                Early Bird Price
              </Text>
            </View>

            <View style={{ gap: 12, marginBottom: 24 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.mutedForeground }}>
                  Service Fee
                </Text>
                <Text style={{ color: colors.foreground }}>$3.50</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.foreground }}>
                  Total
                </Text>
                <Text style={{ fontWeight: "600", color: colors.foreground }}>
                  ${(event.price + 3.5).toFixed(2)}
                </Text>
              </View>
            </View>

            {isOrganizer && (
              <Motion.View
                whileTap={{ scale: 0.98 }}
                style={{ marginBottom: 12 }}
              >
                <Pressable
                  onPress={() =>
                    router.push(`/(protected)/events/${eventId}/organizer`)
                  }
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <QrCode size={20} color="#fff" />
                  <Text
                    style={{ fontWeight: "bold", color: "#fff", fontSize: 16 }}
                  >
                    Manage Tickets
                  </Text>
                </Pressable>
              </Motion.View>
            )}

            {hasTicket ? (
              <View
                style={{
                  backgroundColor: colors.muted,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Check size={20} color={colors.foreground} />
                <Text style={{ fontWeight: "600", color: colors.foreground }}>
                  {"You're Attending"}
                </Text>
              </View>
            ) : (
              <Motion.View whileTap={{ scale: 0.98 }}>
                <Pressable
                  onPress={() => toggleRsvp(eventId)}
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontWeight: "bold", color: "#fff", fontSize: 16 }}
                  >
                    Get Tickets
                  </Text>
                </Pressable>
              </Motion.View>
            )}

            {/* Ratings Section */}
            <Animated.View
              entering={FadeInDown.delay(700)}
              style={{
                marginTop: 24,
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Star size={20} color="#FFD700" />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    Ratings & Reviews
                  </Text>
                </View>
                {eventData?.averageRating > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <StarRatingDisplay
                      rating={eventData.averageRating || 0}
                      starSize={16}
                      color="#FFD700"
                      emptyColor="#E5E5E5"
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: colors.foreground,
                        marginLeft: 4,
                      }}
                    >
                      {eventData.averageRating?.toFixed(1) || "0.0"}
                    </Text>
                    {eventData.totalReviews > 0 && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.mutedForeground,
                          marginLeft: 4,
                        }}
                      >
                        ({eventData.totalReviews})
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Rate Button */}
              <Pressable
                onPress={() => setShowRatingModal(true)}
                style={{
                  backgroundColor: colors.primary + "20",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Star size={18} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.primary,
                  }}
                >
                  Rate This Event
                </Text>
              </Pressable>

              {/* Recent Reviews */}
              {isLoadingReviews ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  Loading reviews...
                </Text>
              ) : reviews.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {reviews.slice(0, 3).map((review: any) => (
                    <View
                      key={review.id}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: colors.foreground,
                            }}
                          >
                            {review.user?.username || review.user?.name || "Anonymous"}
                          </Text>
                          <StarRatingDisplay
                            rating={review.rating || 0}
                            starSize={12}
                            color="#FFD700"
                            emptyColor="#E5E5E5"
                          />
                        </View>
                      </View>
                      {review.comment && (
                        <Text
                          style={{
                            fontSize: 13,
                            color: colors.foreground,
                            lineHeight: 18,
                          }}
                        >
                          {review.comment}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  No ratings yet. Be the first to rate!
                </Text>
              )}
            </Animated.View>

            {/* Comments Section */}
            <Animated.View
              entering={FadeInDown.delay(800)}
              style={{
                marginTop: 24,
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MessageCircle size={20} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    Comments
                  </Text>
                  {comments.length > 0 && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.mutedForeground,
                      }}
                    >
                      ({comments.length})
                    </Text>
                  )}
                </View>
                {comments.length > 5 && (
                  <Pressable
                    onPress={() => router.push(`/(protected)/events/${eventId}/comments`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: colors.primary,
                      }}
                    >
                      View All
                    </Text>
                    <ChevronRight size={16} color={colors.primary} />
                  </Pressable>
                )}
              </View>

              {/* Comments List */}
              {isLoadingComments ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  Loading comments...
                </Text>
              ) : comments.length > 0 ? (
                <View style={{ gap: 16 }}>
                  {comments.slice(0, 5).map((comment: any) => (
                    <View
                      key={comment.id}
                      style={{
                        flexDirection: "row",
                        gap: 12,
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            comment.author?.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              comment.author?.username || comment.author?.name || "User",
                            )}`,
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.foreground,
                            marginBottom: 4,
                          }}
                        >
                          {comment.author?.username || comment.author?.name || "User"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: colors.foreground,
                            lineHeight: 20,
                          }}
                        >
                          {comment.content}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.mutedForeground,
                            marginTop: 4,
                          }}
                        >
                          {comment.createdAt
                            ? new Date(comment.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  No comments yet. Be the first to comment!
                </Text>
              )}

              {/* Add Comment Button */}
              <Pressable
                onPress={() => router.push(`/(protected)/events/${eventId}/comments`)}
                style={{
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MessageCircle size={18} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: colors.primary,
                  }}
                >
                  Add a Comment
                </Text>
              </Pressable>
            </Animated.View>

            <View
              style={{
                marginTop: 24,
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 12,
                }}
              >
                Ticket Includes:
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  "Access to all participating venues",
                  "No cover charges",
                  "Exclusive drink specials",
                  "Event wristband",
                ].map((item) => (
                  <View
                    key={item}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: "#22c55e" }}>✓</Text>
                    <Text style={{ color: colors.mutedForeground }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      </Animated.ScrollView>

      {hasTicket && (
        <Motion.View
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#000000",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom,
          }}
        >
          <View style={{ paddingTop: 24 }}>
            <Motion.View whileTap={{ scale: 0.98 }}>
              <Pressable
                onPress={() => router.push(`/ticket/${eventId}`)}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Ticket size={22} color="#fff" />
                <Text
                  style={{ fontWeight: "bold", color: "#fff", fontSize: 16 }}
                >
                  View Your Ticket
                </Text>
              </Pressable>
            </Motion.View>
          </View>
        </Motion.View>
      )}

      {/* Rating Modal */}
      <EventRatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        eventId={eventId}
        onSubmit={async (rating, comment) => {
          await createReview.mutateAsync({
            eventId,
            rating,
            comment,
          });
        }}
      />
    </View>
  );
}
