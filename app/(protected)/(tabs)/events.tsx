import { View, Text, Pressable } from "react-native"
import { Image } from "expo-image"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { Heart, Share2, Bookmark, Plus } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { LinearGradient } from "expo-linear-gradient"
import { Motion } from "@legendapp/motion"
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, FadeInDown } from "react-native-reanimated"
import { useState, useEffect } from "react"
import { EventsSkeleton } from "@/components/skeletons"

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
    const translateY = (scrollY.value - index * (CARD_HEIGHT + 20)) * -0.15
    return {
      transform: [{ translateY }],
    }
  })

  return (
    <Animated.View entering={FadeInDown.delay(index * 150).duration(800).springify()}>
    <Motion.View
      className="rounded-3xl overflow-hidden mb-5"
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
    <Pressable onPress={() => router.push(`/(protected)/events/${event.id}` as any)}>
      <View style={{ height: CARD_HEIGHT }} className="w-full">
        <Animated.View style={[{ width: "100%", height: CARD_HEIGHT + 100, position: "absolute", top: -50 }, animatedImageStyle]}>
          <Image
            source={{ uri: event.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </Animated.View>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]}
          className="absolute inset-0"
        />

        {/* Attendees */}
        <View className="absolute top-4 left-4 flex-row items-center">
          {event.attendees.map((attendee: any, idx: number) => (
            <View
              key={idx}
              className="w-10 h-10 rounded-full border-2 border-background justify-center items-center overflow-hidden"
              style={{
                marginLeft: idx === 0 ? 0 : -12,
                backgroundColor: attendee.initials ? AVATAR_COLORS[idx % 5] : "transparent",
              }}
            >
              {attendee.image ? (
                <Image source={{ uri: attendee.image }} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text className="text-white text-xs font-semibold">{attendee.initials}</Text>
              )}
            </View>
          ))}
          <View className="ml-2 bg-black/40 px-2 py-1 rounded-xl">
            <Text className="text-white text-xs font-medium">+{event.totalAttendees - event.attendees.length}</Text>
          </View>
        </View>

        {/* Date Badge */}
        <Motion.View
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: index * 0.1 }}
          className="absolute top-4 right-4 bg-background rounded-2xl px-4 py-3 items-center min-w-[70px]"
        >
          <Text className="text-2xl font-bold text-foreground">{event.date}</Text>
          <Text className="text-[10px] text-muted-foreground uppercase mt-0.5">{event.month}</Text>
        </Motion.View>

        {/* Event Details */}
        <Animated.View className="absolute bottom-0 left-0 right-0 p-6">
          <View className="bg-white/20 px-3 py-1.5 rounded-xl self-start mb-3">
            <Text className="text-white text-xs font-medium">{event.category}</Text>
          </View>
          <Text className="text-white text-[28px] font-bold mb-2">{event.title}</Text>
          <Text className="text-white/80 text-sm mb-4">
            {event.time} • {event.totalAttendees} participants
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Pressable className="flex-row items-center gap-1.5 bg-white/20 px-4 py-2 rounded-full">
                <Heart size={16} color="#fff" />
                <Text className="text-white text-sm font-medium">{formatLikes(event.likes)}</Text>
              </Pressable>
              <Pressable className="bg-white/20 p-2 rounded-full">
                <Share2 size={16} color="#fff" />
              </Pressable>
              <Pressable className="bg-white/20 p-2 rounded-full">
                <Bookmark size={16} color="#fff" />
              </Pressable>
            </View>
            <View className="bg-primary px-5 py-2 rounded-full">
              <Text className="text-white text-base font-bold">${event.price}</Text>
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEvents = async () => {
      await new Promise(resolve => setTimeout(resolve, 700))
      setIsLoading(false)
    }
    loadEvents()
  }, [])

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

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <Main className="flex-1">
          <EventsSkeleton />
        </Main>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Main className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View>
            <Text className="text-xs uppercase tracking-wide text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            <Text className="text-2xl font-bold text-foreground">Events</Text>
          </View>
          <Motion.View
            whileTap={{ scale: 0.9 }}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          >
            <Pressable onPress={() => router.push("/(protected)/events/create" as any)} className="w-full h-full items-center justify-center">
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
