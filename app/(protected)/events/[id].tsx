import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  StatusBar,
} from "react-native";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventKeys } from "@/lib/hooks/use-events";
import { getCurrentUserIdInt } from "@/lib/api/auth-helper";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Share2,
  Heart,
  MapPin,
  Star,
  MessageCircle,
  ChevronRight,
  BadgeCheck,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { useEventViewStore } from "@/lib/stores/event-store";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { eventsApi } from "@/lib/api/events";
import {
  useEventReviews,
  useCreateEventReview,
} from "@/lib/hooks/use-event-reviews";
import { useEventComments } from "@/lib/hooks/use-event-comments";
import { EventRatingModal } from "@/components/event-rating-modal";
import { StarRatingDisplay } from "react-native-star-rating-widget";
import { shareEvent } from "@/lib/utils/sharing";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  CountdownTimer,
  SocialProofRow,
  CollapsibleRow,
  TicketTierCard,
  StickyCTA,
  EventDetailSkeleton,
} from "@/src/events/ui";
import type {
  TicketTier,
  EventAttendee,
  EventDetail,
} from "@/src/events/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 420;

// ── Helpers ──────────────────────────────────────────────────────────

function buildTicketTiers(event: EventDetail): TicketTier[] {
  const price = event.price || 0;
  const maxAttendees = event.maxAttendees || 200;
  const currentAttendees = event.attendees || 0;
  const remaining = Math.max(0, maxAttendees - currentAttendees);

  if (price === 0) {
    return [
      {
        id: "free",
        name: "Free Entry",
        price: 0,
        perks: ["General admission", "Access to all areas"],
        remaining,
        maxPerOrder: 4,
        isSoldOut: remaining === 0,
        tier: "free",
        glowColor: "#22c55e",
      },
    ];
  }

  return [
    {
      id: "ga",
      name: "General Admission",
      price,
      originalPrice: Math.round(price * 1.4),
      perks: ["Standard entry", "Access to main floor"],
      remaining: Math.max(0, Math.floor(remaining * 0.6)),
      maxPerOrder: 6,
      isSoldOut: remaining === 0,
      tier: "ga",
      glowColor: "rgb(62, 164, 229)",
    },
    {
      id: "vip",
      name: "VIP Access",
      price: Math.round(price * 2.5),
      originalPrice: Math.round(price * 3.5),
      perks: ["Priority entry", "VIP lounge access", "Complimentary drink"],
      remaining: Math.max(0, Math.floor(remaining * 0.25)),
      maxPerOrder: 4,
      isSoldOut: remaining === 0,
      tier: "vip",
      glowColor: "rgb(255, 109, 193)",
    },
    {
      id: "table",
      name: "Table Service",
      price: Math.round(price * 8),
      originalPrice: Math.round(price * 10),
      perks: [
        "Reserved table for 6",
        "Bottle service included",
        "Dedicated host",
      ],
      remaining: Math.max(0, Math.floor(remaining * 0.05)),
      maxPerOrder: 2,
      isSoldOut: remaining === 0,
      tier: "table",
      glowColor: "#eab308",
    },
  ];
}

function buildMockAttendees(count: number): EventAttendee[] {
  const colors = [
    "#22c55e",
    "#f97316",
    "#06b6d4",
    "#14b8a6",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#ec4899",
    "#3b82f6",
    "#10b981",
  ];
  return Array.from({ length: Math.min(count, 8) }, (_, i) => ({
    id: String(i),
    avatar: `https://i.pravatar.cc/150?img=${i + 1}`,
    color: colors[i % colors.length],
  }));
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d
      .toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      .toUpperCase();
  } catch {
    return dateStr;
  }
}

function formatEventTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eventId = id || "";
  const { isRsvped, toggleRsvp } = useEventViewStore();
  const { hasValidTicket, setTicket } = useTicketStore();
  const showToast = useUIStore((s) => s.showToast);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Local UI state ──────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [eventData, setEventData] = useState<EventDetail | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT - 150, HERO_HEIGHT - 80],
      [0, 1],
    ),
  }));

  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT - 120, HERO_HEIGHT - 60],
      [0, 1],
    ),
  }));

  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-200, 0, HERO_HEIGHT],
          [-100, 0, 80],
        ),
      },
    ],
  }));

  const hasTicket = hasValidTicket(eventId) || isRsvped[eventId] || false;

  // ── Fetch event data ────────────────────────────────────────────────
  const { data: reviews = [], isLoading: isLoadingReviews } = useEventReviews(
    eventId,
    5,
  );
  const { data: comments = [], isLoading: isLoadingComments } =
    useEventComments(eventId, 5);
  const createReview = useCreateEventReview();

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const fetched = await eventsApi.getEventById(eventId);
      if (fetched) {
        setEventData(fetched as EventDetail);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error("[EventDetail] Error fetching event:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Check if user has liked this event
  useEffect(() => {
    if (!eventId) return;
    eventsApi
      .isEventLiked(eventId)
      .then(setIsLiked)
      .catch(() => {});
  }, [eventId]);

  const handleToggleLike = useCallback(async () => {
    if (!eventId) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    try {
      if (wasLiked) {
        await eventsApi.unlikeEvent(eventId);
      } else {
        await eventsApi.likeEvent(eventId);
        showToast("success", "Saved", "Event added to your liked events");
      }
      // Invalidate liked events cache so profile updates
      const uid = getCurrentUserIdInt();
      if (uid)
        queryClient.invalidateQueries({ queryKey: eventKeys.liked(uid) });
    } catch (err) {
      setIsLiked(wasLiked);
      showToast("error", "Error", "Failed to update like");
    }
  }, [eventId, isLiked, showToast, queryClient]);

  // ── Derived data ────────────────────────────────────────────────────
  const ticketTiers = useMemo(
    () => (eventData ? buildTicketTiers(eventData) : []),
    [eventData],
  );

  const mockAttendees = useMemo(
    () => buildMockAttendees(eventData?.attendees || 0),
    [eventData?.attendees],
  );

  // Auto-select first tier
  useEffect(() => {
    if (ticketTiers.length > 0 && !selectedTier) {
      setSelectedTier(ticketTiers[0]);
    }
  }, [ticketTiers, selectedTier]);

  const handleSelectTier = useCallback((tier: TicketTier) => {
    setSelectedTier(tier);
  }, []);

  const handleGetTickets = useCallback(() => {
    if (!eventData) return;
    // Block ticket purchase for past events
    const now = new Date();
    if (eventData.endDate && new Date(eventData.endDate) < now) {
      showToast("warning", "Event Ended", "This event has already ended.");
      return;
    }
    if (!eventData.endDate) {
      const dayEnd = new Date(eventData.date);
      dayEnd.setHours(23, 59, 59, 999);
      if (dayEnd < now) {
        showToast("warning", "Event Ended", "This event has already ended.");
        return;
      }
    }
    toggleRsvp(eventId);

    // Create and store ticket so View Ticket page can find it
    const tierLevel = selectedTier?.tier || "ga";
    const qrPayload = btoa(JSON.stringify({ eid: eventId, uid: user?.id }));
    setTicket(eventId, {
      id: `tkt_${Date.now()}`,
      eventId,
      userId: user?.id || "",
      paid: true,
      status: "valid",
      qrToken: qrPayload,
      tier: tierLevel,
      tierName: selectedTier?.name || undefined,
      transferable: tierLevel === "vip" || tierLevel === "table",
      eventTitle: eventData.title,
      eventDate: eventData.date,
      eventEndDate: eventData.endDate,
      eventLocation: eventData.location,
      eventImage: eventData.image,
      dressCode: eventData.dressCode,
      doorPolicy: eventData.doorPolicy,
      entryWindow: eventData.entryWindow,
      perks: selectedTier?.perks || eventData.perks,
    });

    showToast("success", "Confirmed", `You're going to ${eventData.title}!`);
  }, [
    eventId,
    eventData,
    selectedTier,
    user?.id,
    toggleRsvp,
    setTicket,
    showToast,
  ]);

  const handleViewTicket = useCallback(() => {
    router.push(`/ticket/${eventId}` as any);
  }, [router, eventId]);

  const handleShare = useCallback(async () => {
    try {
      await shareEvent(eventId, eventData?.title || "Event");
      showToast("success", "Link Shared", "Event link has been shared!");
    } catch (error) {
      console.error("[EventDetail] Share error:", error);
      showToast("error", "Share Failed", "Unable to share event link.");
    }
  }, [eventId, eventData?.title, showToast]);

  // ── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (hasError || !eventData) {
    return (
      <View style={s.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={s.errorEmoji}>🎭</Text>
        <Text style={s.errorTitle}>Event Not Found</Text>
        <Text style={s.errorSubtitle}>
          This event may have been removed or the link is invalid.
        </Text>
        <Pressable onPress={fetchEvent} style={s.retryButton}>
          <Text style={s.retryText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const event = eventData;
  const host = event.host;
  const dateStr = formatEventDate(event.date);
  const timeStr = formatEventTime(event.date);

  // Check if event has ended — use endDate if available, otherwise use start date
  const isPast = useMemo(() => {
    try {
      const now = new Date();
      if (event.endDate) return new Date(event.endDate) < now;
      // If no endDate, treat event as ended after the start date's day
      const start = new Date(event.date);
      start.setHours(23, 59, 59, 999);
      return start < now;
    } catch {
      return false;
    }
  }, [event.date, event.endDate]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Floating Header ──────────────────────────────────────── */}
      <View style={[s.headerContainer, { paddingTop: insets.top }]}>
        <Animated.View style={[s.headerBg, headerBgStyle]} />
        <View style={s.headerInner}>
          <Pressable onPress={() => router.back()} style={s.headerButton}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Animated.Text
            style={[s.headerTitle, headerTitleStyle]}
            numberOfLines={1}
          >
            {event.title}
          </Animated.Text>
          <View style={s.headerActions}>
            <Pressable onPress={handleShare} style={s.headerButton}>
              <Share2 size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={handleToggleLike} style={s.headerButton}>
              <Heart
                size={20}
                color={isLiked ? "#FF5BFC" : "#fff"}
                fill={isLiked ? "#FF5BFC" : "transparent"}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── 1. HERO SECTION ──────────────────────────────────── */}
        <View style={s.heroWrapper}>
          <Animated.View style={[s.heroImageContainer, heroParallaxStyle]}>
            <Image
              source={{ uri: event.image }}
              style={s.heroImage}
              contentFit="cover"
              transition={300}
            />
          </Animated.View>

          {/* Dark gradient overlay */}
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.3)",
              "transparent",
              "rgba(0,0,0,0.85)",
              "#000",
            ]}
            locations={[0, 0.3, 0.7, 1]}
            style={s.heroGradient}
          />

          {/* Floating chips */}
          <Animated.View entering={FadeIn.delay(200)} style={s.heroChips}>
            {event.price === 0 ? (
              <View style={[s.chip, s.chipFree]}>
                <Text style={s.chipFreeText}>FREE</Text>
              </View>
            ) : (
              <View style={[s.chip, s.chipVip]}>
                <Text style={s.chipVipText}>VIP</Text>
              </View>
            )}
            <View style={s.chip}>
              <Text style={s.chipText}>{dateStr}</Text>
            </View>
            {timeStr ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{timeStr}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Countdown */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={s.heroCountdown}
          >
            <CountdownTimer targetDate={event.date} />
          </Animated.View>
        </View>

        {/* ── 2. CORE INFO BLOCK ───────────────────────────────── */}
        <View style={s.content}>
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={s.eventTitle}>{event.title}</Text>

            {/* Venue + City */}
            <View style={s.venueRow}>
              <MapPin size={16} color="rgb(62, 164, 229)" />
              <Text style={s.venueText}>{event.location}</Text>
            </View>

            {/* Host */}
            <Pressable style={s.hostRow}>
              <Image
                source={{
                  uri:
                    host?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(host?.username || "Host")}&background=1a1a1a&color=fff`,
                }}
                style={s.hostAvatar}
              />
              <Text style={s.hostName}>
                {host?.name || host?.username || "Organizer"}
              </Text>
              {host?.verified && (
                <BadgeCheck size={16} color="rgb(62, 164, 229)" />
              )}
            </Pressable>
          </Animated.View>

          {/* ── 3. SOCIAL PROOF ──────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(200)} style={s.section}>
            <SocialProofRow
              attendees={mockAttendees}
              totalCount={event.attendees || 0}
              followingCount={0}
            />
          </Animated.View>

          {/* ── 4. COLLAPSIBLE EVENT DETAILS ─────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={s.collapsibleSection}
          >
            {event.description ? (
              <CollapsibleRow
                icon="📝"
                title="About"
                content={event.description}
              />
            ) : null}
            {event.lineup && event.lineup.length > 0 ? (
              <CollapsibleRow icon="🎧" title="Lineup" content={event.lineup} />
            ) : null}
            {event.dressCode ? (
              <CollapsibleRow
                icon="👔"
                title="Dress Code"
                content={event.dressCode}
              />
            ) : null}
            {event.doorPolicy ? (
              <CollapsibleRow
                icon="🚪"
                title="Door Policy"
                content={event.doorPolicy}
              />
            ) : null}
            {event.entryWindow ? (
              <CollapsibleRow
                icon="🕘"
                title="Entry Window"
                content={event.entryWindow}
              />
            ) : null}
            {event.perks && event.perks.length > 0 ? (
              <CollapsibleRow
                icon="🍾"
                title="What's Included"
                content={event.perks}
              />
            ) : null}
          </Animated.View>

          {/* ── 5. TICKET TIERS ──────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(400)} style={s.section}>
            <Text style={s.sectionTitle}>Select Your Tier</Text>
            <FlatList
              data={ticketTiers}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.tierList}
              renderItem={({ item }) => (
                <TicketTierCard
                  tier={item}
                  isSelected={selectedTier?.id === item.id}
                  onSelect={handleSelectTier}
                />
              )}
            />
          </Animated.View>

          {/* ── Ratings & Reviews ─────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(500)} style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionHeaderLeft}>
                <Star size={18} color="#FFD700" />
                <Text style={s.sectionTitle}>Ratings & Reviews</Text>
              </View>
              {eventData?.averageRating != null &&
                eventData.averageRating > 0 && (
                  <View style={s.ratingBadge}>
                    <StarRatingDisplay
                      rating={eventData.averageRating}
                      starSize={14}
                      color="#FFD700"
                      emptyColor="#333"
                    />
                    <Text style={s.ratingText}>
                      {eventData.averageRating.toFixed(1)}
                    </Text>
                  </View>
                )}
            </View>

            <Pressable
              onPress={() => setShowRatingModal(true)}
              style={s.rateButton}
            >
              <Star size={16} color="#FF5BFC" />
              <Text style={s.rateButtonText}>Rate This Event</Text>
            </Pressable>

            {isLoadingReviews ? (
              <Text style={s.mutedText}>Loading reviews...</Text>
            ) : reviews.length > 0 ? (
              <View style={{ gap: 10 }}>
                {reviews.slice(0, 3).map((review: any) => (
                  <View key={review.id} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <Text style={s.reviewAuthor}>
                        {review.user?.username ||
                          review.user?.name ||
                          "Anonymous"}
                      </Text>
                      <StarRatingDisplay
                        rating={review.rating || 0}
                        starSize={12}
                        color="#FFD700"
                        emptyColor="#333"
                      />
                    </View>
                    {review.comment && (
                      <Text style={s.reviewComment}>{review.comment}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.mutedText}>No ratings yet. Be the first!</Text>
            )}
          </Animated.View>

          {/* ── Comments ──────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionHeaderLeft}>
                <MessageCircle size={18} color="rgb(62, 164, 229)" />
                <Text style={s.sectionTitle}>Comments</Text>
                {comments.length > 0 && (
                  <Text style={s.commentCount}>({comments.length})</Text>
                )}
              </View>
              {comments.length > 5 && (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(protected)/events/${eventId}/comments` as any,
                    )
                  }
                  style={s.viewAllButton}
                >
                  <Text style={s.viewAllText}>View All</Text>
                  <ChevronRight size={14} color="rgb(62, 164, 229)" />
                </Pressable>
              )}
            </View>

            {isLoadingComments ? (
              <Text style={s.mutedText}>Loading comments...</Text>
            ) : comments.length > 0 ? (
              <View style={{ gap: 14 }}>
                {comments.slice(0, 5).map((comment: any) => (
                  <View key={comment.id} style={s.commentRow}>
                    <Image
                      source={{
                        uri:
                          comment.author?.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.username || "User")}&background=1a1a1a&color=fff`,
                      }}
                      style={s.commentAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentAuthor}>
                        {comment.author?.username ||
                          comment.author?.name ||
                          "User"}
                      </Text>
                      <Text style={s.commentContent}>{comment.content}</Text>
                      {comment.createdAt && (
                        <Text style={s.commentDate}>
                          {new Date(comment.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.mutedText}>No comments yet. Be the first!</Text>
            )}

            <Pressable
              onPress={() =>
                router.push(`/(protected)/events/${eventId}/comments` as any)
              }
              style={s.addCommentButton}
            >
              <MessageCircle size={16} color="rgb(62, 164, 229)" />
              <Text style={s.addCommentText}>Add a Comment</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.ScrollView>

      {/* ── 6. STICKY CTA BAR ──────────────────────────────────── */}
      <StickyCTA
        selectedTier={selectedTier}
        hasTicket={hasTicket}
        isPast={isPast}
        onGetTickets={handleGetTickets}
        onViewTicket={handleViewTicket}
      />

      {/* Rating Modal */}
      <EventRatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        eventId={eventId}
        onSubmit={async (rating, comment) => {
          await createReview.mutateAsync({ eventId, rating, comment });
        }}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Header
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  headerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },

  // Scroll
  scroll: {
    flex: 1,
  },

  // Hero
  heroWrapper: {
    height: HERO_HEIGHT,
    overflow: "hidden",
  },
  heroImageContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImage: {
    width: "100%",
    height: "120%",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroChips: {
    position: "absolute",
    bottom: 70,
    left: 20,
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  chipVip: {
    backgroundColor: "rgba(255,109,193,0.2)",
    borderColor: "rgba(255,109,193,0.3)",
  },
  chipVipText: {
    color: "rgb(255, 109, 193)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chipFree: {
    backgroundColor: "rgba(62, 164, 229, 0.2)",
    borderColor: "rgba(62, 164, 229, 0.3)",
  },
  chipFreeText: {
    color: "rgb(62, 164, 229)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroCountdown: {
    position: "absolute",
    bottom: 24,
    left: 20,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  eventTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  venueText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  hostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(62, 164, 229, 0.3)",
  },
  hostName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Sections
  section: {
    marginTop: 24,
  },
  collapsibleSection: {
    marginTop: 24,
    gap: 8,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Ticket tiers
  tierList: {
    paddingRight: 20,
  },

  // Ratings
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 91, 252, 0.1)",
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 91, 252, 0.15)",
  },
  rateButtonText: {
    color: "#FF5BFC",
    fontSize: 14,
    fontWeight: "600",
  },
  reviewCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  reviewAuthor: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewComment: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 18,
  },

  // Comments
  commentCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    color: "rgb(62, 164, 229)",
    fontSize: 14,
    fontWeight: "500",
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  commentAuthor: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentContent: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
  commentDate: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    marginTop: 3,
  },
  addCommentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(62, 164, 229, 0.15)",
    backgroundColor: "rgba(62, 164, 229, 0.06)",
  },
  addCommentText: {
    color: "rgb(62, 164, 229)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Shared
  mutedText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },

  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: "rgb(62, 164, 229)",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  backLink: {
    paddingVertical: 8,
  },
  backLinkText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
});
