import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import { Galeria } from "@nandorojo/galeria";
import { LegendList } from "@/components/list";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Trash2,
  QrCode,
  LayoutDashboard,
  ScanLine,
  CalendarPlus,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { useEventViewStore } from "@/lib/stores/event-store";
import { useTicketStore } from "@/lib/stores/ticket-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { eventsApi } from "@/lib/api/events";
import { ticketsApi } from "@/lib/api/tickets";
import * as WebBrowser from "expo-web-browser";
import * as Calendar from "expo-calendar";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { deleteEvent as deleteEventPrivileged } from "@/lib/api/privileged";
import { useCreateEventReview } from "@/lib/hooks/use-event-reviews";
import { EventRatingModal } from "@/components/event-rating-modal";
import { StarRatingDisplay } from "react-native-star-rating-widget";
import { shareEvent } from "@/lib/utils/sharing";
import { useUIStore } from "@/lib/stores/ui-store";
import { useOfflineCheckinStore } from "@/lib/stores/offline-checkin-store";
import { MENTION_COLOR } from "@/src/constants/mentions";
import {
  CountdownTimer,
  SocialProofRow,
  CollapsibleRow,
  TicketTierCard,
  StickyCTA,
  EventDetailSkeleton,
  WeatherModule,
} from "@/src/events/ui";
import type {
  TicketTier,
  EventAttendee,
  EventDetail,
} from "@/src/events/types";
import { YouTubeEmbed } from "@/components/youtube-embed";

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
        glowColor: "#3FDCFF",
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
      glowColor: "#34A2DF",
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
      glowColor: "#8A40CF",
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
      glowColor: "#FF5BFC",
    },
  ];
}

function buildPlaceholderAttendees(count: number): EventAttendee[] {
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
    avatar: "",
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
  const offlineCheckin = useOfflineCheckinStore();
  const offlineTokenCount = (offlineCheckin.tokensByEvent[eventId] || [])
    .length;

  const handleDownloadOffline = useCallback(async () => {
    if (!eventId) return;
    showToast("info", "Downloading...", "Fetching ticket data for offline use");
    try {
      const tokens = await ticketsApi.downloadOfflineTokens(eventId);
      if (tokens.length === 0) {
        showToast(
          "warning",
          "No Tickets",
          "No active tickets found for this event",
        );
        return;
      }
      offlineCheckin.setTokensForEvent(eventId, tokens);
      showToast(
        "success",
        "Downloaded",
        `${tokens.length} tickets cached for offline check-in`,
      );
    } catch (err) {
      console.error("[EventDetail] Offline download error:", err);
      showToast("error", "Error", "Failed to download offline data");
    }
  }, [eventId, offlineCheckin, showToast]);

  // ── Local UI state ──────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
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

  // ── Fetch event data via single batch RPC ─────────────────────────
  const createReview = useCreateEventReview();

  const {
    data: eventData,
    isLoading,
    isError: hasError,
    refetch: fetchEvent,
  } = useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => eventsApi.getEventById(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync isLiked from batch payload
  useEffect(() => {
    if (eventData?.isLiked != null) {
      setIsLiked(eventData.isLiked);
    }
  }, [eventData?.isLiked]);

  // Derive reviews + comments from batch payload
  const reviews = eventData?.topReviews || [];
  const comments = eventData?.topComments || [];
  const isLoadingReviews = isLoading;
  const isLoadingComments = isLoading;

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
  // Use real ticket tiers from DB when available, fall back to synthetic
  const ticketTiers = useMemo(() => {
    if (!eventData) return [];
    const dbTiers = eventData.ticketTiers;
    if (Array.isArray(dbTiers) && dbTiers.length > 0) {
      return dbTiers.map((t: any, i: number) => ({
        id: t.id,
        name: t.name,
        price: (t.price_cents || 0) / 100,
        originalPrice: undefined,
        perks: [],
        remaining: t.quantity_total
          ? Math.max(0, t.quantity_total - (t.quantity_sold || 0))
          : undefined,
        maxPerOrder: t.max_per_user || 4,
        isSoldOut: t.quantity_total
          ? (t.quantity_sold || 0) >= t.quantity_total
          : false,
        tier: i === 0 ? "ga" : i === 1 ? "vip" : "table",
        glowColor: ["#34A2DF", "#8A40CF", "#FF5BFC"][i % 3],
        saleStart: t.sale_start,
        saleEnd: t.sale_end,
      })) as TicketTier[];
    }
    return buildTicketTiers(eventData);
  }, [eventData]);

  // Use real attendee avatars from batch payload, fall back to mock
  const realAttendees = useMemo(() => {
    const avatars = eventData?.attendeeAvatars;
    if (Array.isArray(avatars) && avatars.length > 0) {
      return avatars.map((a: any) => ({
        id: String(a.id || ""),
        avatar: a.avatar || "",
        color: "#3b82f6",
      }));
    }
    return buildPlaceholderAttendees(eventData?.attendees || 0);
  }, [eventData?.attendeeAvatars, eventData?.attendees]);

  // Auto-select first tier
  useEffect(() => {
    if (ticketTiers.length > 0 && !selectedTier) {
      setSelectedTier(ticketTiers[0]);
    }
  }, [ticketTiers, selectedTier]);

  const handleSelectTier = useCallback((tier: TicketTier) => {
    setSelectedTier(tier);
  }, []);

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleGetTickets = useCallback(async () => {
    if (!eventData || isCheckingOut) return;
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

    // ── Stripe checkout path (when ticketing feature is ON) ──
    if (isFeatureEnabled("ticketing_enabled") && eventData.ticketingEnabled) {
      setIsCheckingOut(true);
      try {
        const result = await ticketsApi.checkout({
          eventId,
          ticketTypeId: selectedTier?.id || "",
          quantity: 1,
          userId: user?.id || "",
        });

        if (result.error) {
          showToast("error", "Checkout Failed", result.error);
          return;
        }

        // Free ticket — issued server-side, store locally
        if (result.free && result.tickets?.length) {
          const t = result.tickets[0];
          setTicket(eventId, {
            id: t.id,
            eventId,
            userId: user?.id || "",
            paid: false,
            status: "valid",
            qrToken: t.qr_token,
            tier: selectedTier?.tier || "ga",
            tierName: selectedTier?.name || undefined,
            transferable: false,
            eventTitle: eventData.title,
            eventDate: eventData.date,
            eventEndDate: eventData.endDate,
            eventLocation: eventData.location,
            eventImage: eventData.image,
          });
          toggleRsvp(eventId);
          queryClient.setQueryData(eventKeys.detail(eventId), (old: any) =>
            old ? { ...old, attendees: (old.attendees || 0) + 1 } : old,
          );
          queryClient.invalidateQueries({ queryKey: eventKeys.all });
          showToast(
            "success",
            "Confirmed",
            `You're going to ${eventData.title}!`,
          );
          return;
        }

        // Paid ticket — open Stripe Checkout in browser
        if (result.url) {
          await WebBrowser.openBrowserAsync(result.url, {
            presentationStyle:
              Platform.OS === "ios"
                ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
                : undefined,
          });
          // After browser closes, check if ticket was created by webhook
          const myTickets = await ticketsApi.getMyTickets();
          const newTicket = myTickets.find(
            (t) =>
              String(t.event_id) === String(eventId) && t.status === "active",
          );
          if (newTicket) {
            setTicket(eventId, {
              id: newTicket.id,
              eventId,
              userId: user?.id || "",
              paid: true,
              status: "valid",
              qrToken: newTicket.qr_token,
              tier: selectedTier?.tier || "ga",
              tierName: newTicket.ticket_type_name || selectedTier?.name,
              transferable: false,
              eventTitle: eventData.title,
              eventDate: eventData.date,
              eventEndDate: eventData.endDate,
              eventLocation: eventData.location,
              eventImage: eventData.image,
            });
            toggleRsvp(eventId);
            queryClient.setQueryData(eventKeys.detail(eventId), (old: any) =>
              old ? { ...old, attendees: (old.attendees || 0) + 1 } : old,
            );
            queryClient.invalidateQueries({ queryKey: eventKeys.all });
            showToast(
              "success",
              "Ticket Purchased",
              `You're going to ${eventData.title}!`,
            );
          }
          return;
        }
      } catch (err: any) {
        console.error("[EventDetail] Checkout error:", err);
        showToast("error", "Error", err.message || "Checkout failed");
      } finally {
        setIsCheckingOut(false);
      }
      return;
    }

    // ── Legacy RSVP path (ticketing OFF) ──
    toggleRsvp(eventId);

    // Optimistically update local attendee count
    queryClient.setQueryData(eventKeys.detail(eventId), (old: any) =>
      old ? { ...old, attendees: (old.attendees || 0) + 1 } : old,
    );

    // Persist RSVP to database (increments total_attendees via RPC)
    eventsApi.rsvpEvent(eventId, "going").catch((err) => {
      console.error("[EventDetail] rsvpEvent error:", err);
    });

    // Invalidate event queries so lists refresh
    queryClient.invalidateQueries({ queryKey: eventKeys.all });

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
    isCheckingOut,
    toggleRsvp,
    setTicket,
    showToast,
    queryClient,
  ]);

  const handleViewTicket = useCallback(() => {
    router.push(`/ticket/${eventId}` as any);
  }, [router, eventId]);

  const isHost = !!(
    user?.id &&
    eventData?.host?.id &&
    String(user.id) === String(eventData.host.id)
  );

  const handleDeleteEvent = useCallback(() => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEventPrivileged(parseInt(eventId));
              queryClient.invalidateQueries({ queryKey: eventKeys.all });
              showToast("success", "Deleted", "Event has been deleted.");
              router.back();
            } catch (err) {
              console.error("[EventDetail] Delete error:", err);
              showToast("error", "Error", "Failed to delete event.");
            }
          },
        },
      ],
    );
  }, [eventId, queryClient, showToast, router]);

  const handleShare = useCallback(async () => {
    try {
      await shareEvent(eventId, eventData?.title || "Event");
      showToast("success", "Link Shared", "Event link has been shared!");
    } catch (error) {
      console.error("[EventDetail] Share error:", error);
      showToast("error", "Share Failed", "Unable to share event link.");
    }
  }, [eventId, eventData?.title, showToast]);

  const handleAddToCalendar = useCallback(async () => {
    if (!eventData) return;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "error",
          "Permission Denied",
          "Calendar access is required to add events",
        );
        return;
      }

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const defaultCal =
        calendars.find(
          (c) => c.allowsModifications && c.source?.name === "iCloud",
        ) ||
        calendars.find((c) => c.allowsModifications) ||
        calendars[0];

      if (!defaultCal) {
        showToast(
          "error",
          "No Calendar",
          "No writable calendar found on this device",
        );
        return;
      }

      const startDate = eventData.fullDate
        ? new Date(eventData.fullDate)
        : new Date(eventData.date);
      const endDate = eventData.endDate
        ? new Date(eventData.endDate)
        : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // default 3h

      await Calendar.createEventAsync(defaultCal.id, {
        title: eventData.title,
        startDate,
        endDate,
        location: eventData.location || eventData.locationName || "",
        notes: eventData.description || "",
        timeZone: "America/New_York",
      });

      showToast(
        "success",
        "Added to Calendar",
        `${eventData.title} has been added to your calendar`,
      );
    } catch (err) {
      console.error("[EventDetail] Calendar error:", err);
      showToast("error", "Error", "Failed to add event to calendar");
    }
  }, [eventData, showToast]);

  // CRITICAL: useMemo MUST be called before any early returns (React hooks rules)
  const isPast = useMemo(() => {
    if (!eventData) return false;
    try {
      const now = new Date();
      if (eventData.endDate) return new Date(eventData.endDate) < now;
      const start = new Date(eventData.date);
      start.setHours(23, 59, 59, 999);
      return start < now;
    } catch {
      return false;
    }
  }, [eventData]);

  // Rating eligibility: event ended + user has ticket/RSVP + not the host
  const isHostUser = !!(
    user?.id &&
    eventData?.host?.id &&
    String(user.id) === String(eventData.host.id)
  );

  const canRate = useMemo(() => {
    if (!isPast) return false;
    if (!hasTicket) return false;
    if (isHostUser) return false;
    return true;
  }, [isPast, hasTicket, isHostUser]);

  const ratingIneligibleReason = useMemo(() => {
    if (isHostUser) return "Hosts cannot rate their own event";
    if (!isPast) return "Ratings unlock after the event ends";
    if (!hasTicket) return "Only verified attendees can rate";
    return "";
  }, [isPast, hasTicket, isHostUser]);

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
        <Pressable onPress={() => fetchEvent()} style={s.retryButton}>
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

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <Animated.ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── 1. HERO SECTION ──────────────────────────────────── */}
        <View style={s.heroWrapper}>
          {/* Parallax hero image */}
          <Animated.View style={[s.heroImageContainer, heroParallaxStyle]}>
            <Image
              source={{ uri: event.image }}
              style={s.heroImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </Animated.View>

          {/* Dark gradient overlay */}
          <LinearGradient
            colors={[
              "rgba(52,162,223,0.25)",
              "transparent",
              "rgba(138,64,207,0.35)",
              "#000",
            ]}
            locations={[0, 0.25, 0.7, 1]}
            style={s.heroGradient}
          />

          {/* Floating chips */}
          <View style={s.heroChips}>
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
          </View>

          {/* Countdown */}
          <View style={s.heroCountdown}>
            <CountdownTimer targetDate={event.date} />
          </View>
        </View>

        {/* ── 2. CORE INFO BLOCK ───────────────────────────────── */}
        <View style={s.content}>
          <View>
            <Text style={s.eventTitle}>{event.title}</Text>

            {/* Venue + City */}
            <View style={s.venueRow}>
              <MapPin size={16} color="#3FDCFF" />
              <Text style={s.venueText}>{event.location}</Text>
            </View>

            {/* Host */}
            <Pressable style={s.hostRow}>
              <Image
                source={{
                  uri: host?.avatar || "",
                }}
                style={s.hostAvatar}
              />
              <Text style={s.hostName}>
                {host?.name || host?.username || "Organizer"}
              </Text>
              {host?.verified && <BadgeCheck size={16} color="#34A2DF" />}
            </Pressable>
          </View>

          {/* ── 3. SOCIAL PROOF ──────────────────────────────────── */}
          <View style={s.section}>
            <SocialProofRow
              attendees={realAttendees}
              totalCount={event.attendees || 0}
              followingCount={0}
            />
          </View>

          {/* ── 3.25 HOST ORGANIZER TOOLS ──────────────────────────── */}
          {isHost && isFeatureEnabled("organizer_tools_enabled") ? (
            <View style={s.section}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(protected)/events/${eventId}/organizer` as any,
                    )
                  }
                  style={[s.organizerButton, { flex: 1 }]}
                >
                  <LayoutDashboard size={16} color="#8A40CF" />
                  <Text style={s.organizerButtonText}>Dashboard</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push(`/(protected)/events/${eventId}/scanner` as any)
                  }
                  style={[s.organizerButton, { flex: 1 }]}
                >
                  <ScanLine size={16} color="#22C55E" />
                  <Text style={s.organizerButtonText}>Scanner</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handleDownloadOffline}
                style={[s.organizerButton, { marginTop: 8 }]}
              >
                <Text style={s.organizerButtonText}>
                  {offlineTokenCount > 0
                    ? `✅ ${offlineTokenCount} tickets cached for offline`
                    : "📲 Download for Offline Check-in"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── 3.5 WEATHER FORECAST ─────────────────────────────── */}
          {event.locationLat && event.locationLng ? (
            <View style={s.section}>
              <WeatherModule lat={event.locationLat} lng={event.locationLng} />
            </View>
          ) : null}

          {/* ── 4. COLLAPSIBLE EVENT DETAILS ─────────────────────── */}
          <View style={s.collapsibleSection}>
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
          </View>

          {/* ── 4b. YOUTUBE VIDEO ──────────────────────────────── */}
          {event.youtubeVideoUrl ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Video</Text>
              <YouTubeEmbed url={event.youtubeVideoUrl} height={220} />
            </View>
          ) : null}

          {/* ── 4c. EVENT IMAGES ───────────────────────────────── */}
          {event.images && event.images.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Photos</Text>
              <Galeria
                urls={event.images
                  .map((img: any) => (typeof img === "string" ? img : img?.url))
                  .filter(Boolean)}
                theme="dark"
              >
                <View style={s.imageGrid}>
                  {event.images.map((img: any, idx: number) => {
                    const imageUrl = typeof img === "string" ? img : img?.url;
                    if (!imageUrl) return null;
                    return (
                      <Galeria.Image index={idx} key={idx}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={s.imageGridImage}
                        />
                      </Galeria.Image>
                    );
                  })}
                </View>
              </Galeria>
            </View>
          ) : null}

          {/* ── 5. TICKET TIERS ──────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Select Your Tier</Text>
            <LegendList
              data={ticketTiers}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.tierList}
              estimatedItemSize={200}
              renderItem={({ item }) => (
                <TicketTierCard
                  tier={item}
                  isSelected={selectedTier?.id === item.id}
                  onSelect={handleSelectTier}
                />
              )}
            />
          </View>

          {/* ── Ratings & Reviews ─────────────────────────────────── */}
          <View style={s.section}>
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

            {canRate ? (
              <Pressable
                onPress={() => setShowRatingModal(true)}
                style={s.rateButton}
              >
                <Star size={16} color="#FF5BFC" />
                <Text style={s.rateButtonText}>Rate This Event</Text>
              </Pressable>
            ) : (
              <View
                style={[s.rateButton, { opacity: 0.4 }]}
                pointerEvents="none"
              >
                <Star size={16} color="#666" />
                <Text style={[s.rateButtonText, { color: "#666" }]}>
                  {ratingIneligibleReason}
                </Text>
              </View>
            )}

            {isLoadingReviews ? (
              <Text style={s.mutedText}>Loading reviews...</Text>
            ) : reviews.length > 0 ? (
              <View style={{ gap: 10 }}>
                {reviews.slice(0, 3).map((review: any) => (
                  <View key={review.id} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <Text style={s.reviewAuthor}>
                        {review.username ||
                          review.user?.username ||
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
              <View
                style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}
              >
                <Star size={28} color="#333" strokeWidth={1.5} />
                <Text style={[s.mutedText, { marginTop: 4 }]}>
                  No ratings yet
                </Text>
                {canRate && (
                  <Text
                    style={{
                      color: "#FF5BFC",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Be the first to rate this event
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ── Comments ──────────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionHeaderLeft}>
                <MessageCircle size={18} color="#34A2DF" />
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
                  <ChevronRight size={14} color="#34A2DF" />
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
                        uri: comment.avatar || comment.author?.avatar || "",
                      }}
                      style={s.commentAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentAuthor}>
                        {comment.username ||
                          comment.author?.username ||
                          comment.author?.name ||
                          "User"}
                      </Text>
                      <Text style={s.commentContent}>
                        {(comment.content || "")
                          .split(/(@\w+)/g)
                          .map((part: string, i: number) =>
                            part.startsWith("@") ? (
                              <Text
                                key={i}
                                onPress={() =>
                                  router.push(
                                    `/(protected)/profile/${part.slice(1)}` as any,
                                  )
                                }
                                style={{
                                  color: MENTION_COLOR,
                                  fontWeight: "600",
                                }}
                              >
                                {part}
                              </Text>
                            ) : (
                              <Text key={i}>{part}</Text>
                            ),
                          )}
                      </Text>
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
              <View
                style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}
              >
                <MessageCircle size={28} color="#333" strokeWidth={1.5} />
                <Text style={[s.mutedText, { marginTop: 4 }]}>
                  No comments yet
                </Text>
                <Text
                  style={{ color: "#34A2DF", fontSize: 13, fontWeight: "600" }}
                >
                  Start the conversation
                </Text>
              </View>
            )}

            <Pressable
              onPress={() =>
                router.push(`/(protected)/events/${eventId}/comments` as any)
              }
              style={s.addCommentButton}
            >
              <MessageCircle size={16} color="#34A2DF" />
              <Text style={s.addCommentText}>Add a Comment</Text>
            </Pressable>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Floating Header (rendered AFTER scroll so it's on top for touches) */}
      <View
        style={[s.headerContainer, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[s.headerBg, headerBgStyle]}
          pointerEvents="none"
        />
        <View style={s.headerInner} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            style={s.headerButton}
            hitSlop={12}
          >
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Animated.Text
            style={[s.headerTitle, headerTitleStyle]}
            numberOfLines={1}
          >
            {event.title}
          </Animated.Text>
          <View style={s.headerActions}>
            {isHost && (
              <Pressable
                onPress={handleDeleteEvent}
                style={s.headerButton}
                hitSlop={12}
              >
                <Trash2 size={20} color="#ef4444" />
              </Pressable>
            )}
            <Pressable
              onPress={handleAddToCalendar}
              style={s.headerButton}
              hitSlop={12}
            >
              <CalendarPlus size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={s.headerButton}
              hitSlop={12}
            >
              <Share2 size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleToggleLike}
              style={s.headerButton}
              hitSlop={12}
            >
              <Heart
                size={20}
                color={isLiked ? "#FF5BFC" : "#fff"}
                fill={isLiked ? "#FF5BFC" : "transparent"}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Sticky CTA ─────────────────────────────────────────── */}
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
          await createReview.mutateAsync({
            eventId,
            rating,
            comment,
            authorUsername: user?.username,
          });
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
    maxWidth: 768,
    width: "100%",
    alignSelf: "center",
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
    backgroundColor: "rgba(138,64,207,0.2)",
    borderColor: "rgba(138,64,207,0.3)",
  },
  chipVipText: {
    color: "#8A40CF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chipFree: {
    backgroundColor: "rgba(63,220,255,0.15)",
    borderColor: "rgba(63,220,255,0.3)",
  },
  chipFreeText: {
    color: "#3FDCFF",
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
    borderColor: "rgba(52,162,223,0.3)",
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
    color: "#34A2DF",
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
    borderRadius: 8,
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
    borderColor: "rgba(52,162,223,0.15)",
    backgroundColor: "rgba(52,162,223,0.06)",
  },
  addCommentText: {
    color: "#34A2DF",
    fontSize: 14,
    fontWeight: "500",
  },

  // Image grid
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageGridItem: {
    width: (SCREEN_WIDTH - 40 - 8) / 2,
    height: (SCREEN_WIDTH - 40 - 8) / 2,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  imageGridImage: {
    width: (SCREEN_WIDTH - 40 - 8) / 2,
    height: (SCREEN_WIDTH - 40 - 8) / 2,
    borderRadius: 14,
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
    backgroundColor: "#34A2DF",
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
  organizerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  organizerButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
