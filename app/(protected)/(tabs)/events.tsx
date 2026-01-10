import { View, Text, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { Heart, Share2, Bookmark, Plus, ArrowLeft } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { LinearGradient } from "expo-linear-gradient"
import { Motion } from "@legendapp/motion"
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, FadeInDown } from "react-native-reanimated"
import { useCallback } from "react"

const { width, height } = Dimensions.get("window")
const CARD_HEIGHT = 500

const events = [
  {
    id: "lower-east-side-winter-bar-fest",
    title: "Lower East Side Winter Bar Fest",
    date: "17",
    month: "JAN",
    time: "6:00 PM",
    location: "Lower East Side, NY",
    price: 35,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1000&fit=crop",
    attendees: [
      { image: "https://i.pravatar.cc/150?img=5", name: "Sarah" },
      { image: "https://i.pravatar.cc/150?img=9", name: "Maria" },
      { name: "JD", initials: "JD" },
      { image: "https://i.pravatar.cc/150?img=10", name: "Emma" },
      { image: "https://i.pravatar.cc/150?img=12", name: "John" },
    ],
    totalAttendees: 127,
    likes: 1100,
    category: "Nightlife",
  },
  {
    id: "brooklyn-jazz-night",
    title: "Brooklyn Jazz Night",
    date: "18",
    month: "JAN",
    time: "8:00 PM",
    location: "Brooklyn, NY",
    price: 45,
    image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&h=1000&fit=crop",
    attendees: [
      { image: "https://i.pravatar.cc/150?img=10", name: "Emma" },
      { name: "MK", initials: "MK" },
      { image: "https://i.pravatar.cc/150?img=12", name: "John" },
      { image: "https://i.pravatar.cc/150?img=16", name: "Alex" },
      { image: "https://i.pravatar.cc/150?img=20", name: "Lisa" },
    ],
    totalAttendees: 89,
    likes: 850,
    category: "Music",
  },
  {
    id: "rooftop-brunch-experience",
    title: "Rooftop Brunch Experience",
    date: "19",
    month: "JAN",
    time: "11:00 AM",
    location: "Manhattan, NY",
    price: 55,
    image: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&h=1000&fit=crop",
    attendees: [
      { image: "https://i.pravatar.cc/150?img=16", name: "Alex" },
      { image: "https://i.pravatar.cc/150?img=20", name: "Lisa" },
      { name: "TC", initials: "TC" },
      { image: "https://i.pravatar.cc/150?img=5", name: "Sarah" },
      { name: "RS", initials: "RS" },
    ],
    totalAttendees: 156,
    likes: 2300,
    category: "Food & Drink",
  },
  {
    id: "tech-networking-mixer",
    title: "Tech Startup Networking Mixer",
    date: "23",
    month: "JAN",
    time: "6:30 PM",
    location: "SoHo, NY",
    price: 25,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=1000&fit=crop",
    attendees: [
      { name: "RS", initials: "RS" },
      { image: "https://i.pravatar.cc/150?img=5", name: "Sarah" },
      { name: "PK", initials: "PK" },
      { image: "https://i.pravatar.cc/150?img=9", name: "Maria" },
      { image: "https://i.pravatar.cc/150?img=12", name: "John" },
    ],
    totalAttendees: 203,
    likes: 1600,
    category: "Networking",
  },
  {
    id: "comedy-show-special",
    title: "Stand-Up Comedy Show Special",
    date: "24",
    month: "JAN",
    time: "7:00 PM",
    location: "Greenwich Village, NY",
    price: 30,
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=1000&fit=crop",
    attendees: [
      { image: "https://i.pravatar.cc/150?img=10", name: "Emma" },
      { image: "https://i.pravatar.cc/150?img=12", name: "John" },
      { name: "AZ", initials: "AZ" },
      { image: "https://i.pravatar.cc/150?img=16", name: "Alex" },
      { name: "GH", initials: "GH" },
    ],
    totalAttendees: 178,
    likes: 1450,
    category: "Entertainment",
  },
  {
    id: "art-gallery-opening",
    title: "Contemporary Art Gallery Opening",
    date: "25",
    month: "JAN",
    time: "5:00 PM",
    location: "Chelsea, NY",
    price: 20,
    image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&h=1000&fit=crop",
    attendees: [
      { image: "https://i.pravatar.cc/150?img=9", name: "Maria" },
      { name: "GH", initials: "GH" },
      { image: "https://i.pravatar.cc/150?img=16", name: "Alex" },
      { image: "https://i.pravatar.cc/150?img=20", name: "Lisa" },
      { name: "TC", initials: "TC" },
    ],
    totalAttendees: 94,
    likes: 720,
    category: "Art & Culture",
  },
]

const AVATAR_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"]

function EventCard({ event, index, scrollY, colors, router, formatLikes }: any) {
  const animatedImageStyle = useAnimatedStyle(() => {
    "worklet"
    // Simple parallax: offset image based on scroll, scaled down
    const translateY = (scrollY.value - index * (CARD_HEIGHT + 20)) * -0.15
    return {
      transform: [{ translateY }],
    }
  })

  return (
    <Animated.View entering={FadeInDown.delay(index * 150).duration(800).springify()}>
    <Motion.View
      style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
    <Pressable onPress={() => router.push(`/(protected)/events/${event.id}` as any)}>
      <View style={{ height: CARD_HEIGHT, width: "100%" }}>
        <Animated.View style={[{ width: "100%", height: CARD_HEIGHT + 100, position: "absolute", top: -50 }, animatedImageStyle]}>
          <Image
            source={{ uri: event.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </Animated.View>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Attendees */}
        <View style={{ position: "absolute", top: 16, left: 16, flexDirection: "row", alignItems: "center" }}>
          {event.attendees.map((attendee: any, idx: number) => (
            <View
              key={idx}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: "#000",
                marginLeft: idx === 0 ? 0 : -12,
                backgroundColor: attendee.initials ? AVATAR_COLORS[idx % 5] : "transparent",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              {attendee.image ? (
                <Image source={{ uri: attendee.image }} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{attendee.initials}</Text>
              )}
            </View>
          ))}
          <View style={{ marginLeft: 8, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>+{event.totalAttendees - event.attendees.length}</Text>
          </View>
        </View>

        {/* Date Badge */}
        <Motion.View
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: index * 0.1 }}
          style={{ position: "absolute", top: 16, right: 16, backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", minWidth: 70 }}
        >
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground }}>{event.date}</Text>
          <Text style={{ fontSize: 10, color: colors.mutedForeground, textTransform: "uppercase", marginTop: 2 }}>{event.month}</Text>
        </Motion.View>

        {/* Event Details */}
        <Animated.View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 24 }}>
          <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: "flex-start", marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>{event.category}</Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>{event.title}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 16 }}>
            {event.time} • {event.totalAttendees} participants
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Heart size={16} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>{formatLikes(event.likes)}</Text>
              </Pressable>
              <Pressable style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 20 }}>
                <Share2 size={16} color="#fff" />
              </Pressable>
              <Pressable style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 20 }}>
                <Bookmark size={16} color="#fff" />
              </Pressable>
            </View>
            <View style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>${event.price}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Pressable>
    </Motion.View>
    </Animated.View>
  )
}

export default function EventsScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const scrollY = useSharedValue(0)
  const insets = useSafeAreaInsets()

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  const formatLikes = (likes: number) => {
    if (likes >= 1000) {
      return `${(likes / 1000).toFixed(1)}k`
    }
    return likes.toString()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View>
            <Text className="text-xs uppercase tracking-wide text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            <Text className="text-2xl font-bold">Events</Text>
          </View>
          <Motion.View
            whileTap={{ scale: 0.9 }}
            style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.primary }}
          >
            <Pressable onPress={() => router.push("/(protected)/events/create" as any)} style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
              <Plus size={20} color="#fff" />
            </Pressable>
          </Motion.View>
        </View>

        <Animated.ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {events.map((event, index) => (
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
      </Main>
    </View>
  )
}
