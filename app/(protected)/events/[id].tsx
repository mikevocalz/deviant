import { View, Text, ScrollView, Pressable, Dimensions } from "react-native"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"
import { Calendar, MapPin, Clock, Users, Share2, Heart, ChevronDown, ArrowLeft, Check } from "lucide-react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { LinearGradient } from "expo-linear-gradient"
import { Motion } from "@legendapp/motion"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useEventViewStore } from "@/lib/stores/event-store"

const { width } = Dimensions.get("window")

const eventsData: Record<string, any> = {
  "lower-east-side-winter-bar-fest": {
    title: "Lower East Side Winter Bar Fest",
    date: "FRI, JAN 17, 2025",
    time: "6:00 PM - 11:00 PM EST",
    location: "Lower East Side, NY",
    price: 35,
    originalPrice: 50,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop",
    totalAttendees: 127,
    ticketsLeft: 44,
    category: "Nightlife",
    description: "Join us for the ultimate winter bar crawl through the Lower East Side! Experience the best bars, clubs, and lounges in one unforgettable night. Your ticket includes exclusive drink specials, no cover charges at participating venues, and a commemorative event wristband.",
    venues: ["The Delancey", "Pianos", "Mercury Lounge", "Arlene's Grocery"],
  },
  "brooklyn-jazz-night": {
    title: "Brooklyn Jazz Night",
    date: "SAT, JAN 18, 2025",
    time: "8:00 PM - 12:00 AM EST",
    location: "Brooklyn, NY",
    price: 45,
    originalPrice: 60,
    image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&h=600&fit=crop",
    totalAttendees: 89,
    ticketsLeft: 32,
    category: "Music",
    description: "Experience the best of Brooklyn's jazz scene in one incredible night. Live performances from local and touring artists in intimate venues across the borough.",
    venues: ["Blue Note", "Smalls Jazz Club", "Village Vanguard", "Jazz Standard"],
  },
  "rooftop-brunch-experience": {
    title: "Rooftop Brunch Experience",
    date: "SUN, JAN 19, 2025",
    time: "11:00 AM - 3:00 PM EST",
    location: "Manhattan, NY",
    price: 55,
    originalPrice: 75,
    image: "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&h=600&fit=crop",
    totalAttendees: 156,
    ticketsLeft: 28,
    category: "Food & Drink",
    description: "Elevate your Sunday with breathtaking views and delicious brunch offerings at Manhattan's most exclusive rooftop venues.",
    venues: ["230 Fifth", "The Press Lounge", "Westlight", "Mr. Purple"],
  },
  "tech-networking-mixer": {
    title: "Tech Startup Networking Mixer",
    date: "THU, JAN 23, 2025",
    time: "6:30 PM - 9:30 PM EST",
    location: "SoHo, NY",
    price: 25,
    originalPrice: 40,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
    totalAttendees: 203,
    ticketsLeft: 67,
    category: "Networking",
    description: "Connect with founders, investors, and tech professionals in NYC's startup ecosystem. Great opportunity to expand your network and discover new opportunities.",
    venues: ["WeWork SoHo", "Alley NYC", "General Assembly", "Galvanize"],
  },
  "comedy-show-special": {
    title: "Stand-Up Comedy Show Special",
    date: "FRI, JAN 24, 2025",
    time: "7:00 PM - 10:00 PM EST",
    location: "Greenwich Village, NY",
    price: 30,
    originalPrice: 45,
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=600&fit=crop",
    totalAttendees: 178,
    ticketsLeft: 22,
    category: "Entertainment",
    description: "Laugh the night away with NYC's best comedians. Featuring headliners and up-and-coming talent in the heart of Greenwich Village.",
    venues: ["Comedy Cellar", "The Stand", "Gotham Comedy Club", "Caroline's"],
  },
  "art-gallery-opening": {
    title: "Contemporary Art Gallery Opening",
    date: "SAT, JAN 25, 2025",
    time: "5:00 PM - 9:00 PM EST",
    location: "Chelsea, NY",
    price: 20,
    originalPrice: 35,
    image: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&h=600&fit=crop",
    totalAttendees: 94,
    ticketsLeft: 56,
    category: "Art & Culture",
    description: "Be among the first to experience groundbreaking contemporary art at Chelsea's newest gallery opening. Complimentary wine and hors d'oeuvres included.",
    venues: ["Gagosian", "David Zwirner", "Pace Gallery", "Hauser & Wirth"],
  },
}

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
]

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useColorScheme()
  const eventId = id || "lower-east-side-winter-bar-fest"
  const { isRsvped, toggleRsvp } = useEventViewStore()
  const hasTicket = isRsvped[eventId] || false

  const event = eventsData[eventId] || eventsData["lower-east-side-winter-bar-fest"]

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={{ height: 400, width: "100%" }}>
          <Image source={{ uri: event.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <LinearGradient
            colors={["transparent", colors.background]}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 150 }}
          />
        </View>

        {/* Content */}
        <View style={{ padding: 16, marginTop: -60 }}>
          {/* Urgency Banner */}
          <Animated.View entering={FadeInDown.delay(100)} style={{ backgroundColor: "rgba(234, 179, 8, 0.2)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ color: "#eab308", fontWeight: "600" }}>🔥 Only {event.ticketsLeft} tickets left at this price!</Text>
          </Animated.View>

          {/* Title & Actions */}
          <Animated.View entering={FadeInDown.delay(200)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.foreground, flex: 1, marginRight: 16 }}>{event.title}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Share2 size={20} color={colors.foreground} />
              </Pressable>
              <Pressable style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Heart size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Event Info */}
          <Animated.View entering={FadeInDown.delay(300)} style={{ gap: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>{event.date}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Clock size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>{event.time}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MapPin size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>{event.location}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Users size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }}>{event.totalAttendees} attending</Text>
            </View>
          </Animated.View>

          {/* Referral Banner */}
          <Animated.View entering={FadeInDown.delay(400)} style={{ backgroundColor: colors.primary + "20", borderRadius: 12, padding: 16, marginBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: colors.foreground }}>Invite friends, earn $4.00 per order</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Share your unique link and get rewards</Text>
            </View>
            <Pressable style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Get Link</Text>
            </Pressable>
          </Animated.View>

          {/* About Section */}
          <Animated.View entering={FadeInDown.delay(500)} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>About This Event</Text>
            <Text style={{ color: colors.foreground, lineHeight: 24 }}>{event.description}</Text>
          </Animated.View>

          {/* Venues */}
          <Animated.View entering={FadeInDown.delay(600)} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>Featured Venues</Text>
            <View style={{ gap: 12 }}>
              {event.venues.map((venue: string) => (
                <View key={venue} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                    <MapPin size={24} color={colors.mutedForeground} />
                  </View>
                  <View>
                    <Text style={{ fontWeight: "600", color: colors.foreground }}>{venue}</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Participating venue</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Who's Going */}
          <Animated.View entering={FadeInDown.delay(700)} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground }}>Who's Going</Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{event.totalAttendees} attending</Text>
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {allAttendees.map((attendee, index) => (
                  <View
                    key={index}
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
                      <Image source={{ uri: attendee.image }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{attendee.initials}</Text>
                    )}
                  </View>
                ))}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>+{event.totalAttendees - 10}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Ticket Card */}
          <Animated.View entering={FadeInDown.delay(800)} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, marginBottom: 100 }}>
            {hasTicket && (
              <View style={{ alignItems: "center", paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 24 }}>
                <Text style={{ fontWeight: "600", color: colors.foreground, marginBottom: 16 }}>Your Ticket</Text>
                <View style={{ width: 150, height: 150, backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 64 }}>🎟️</Text>
                  <Text style={{ fontSize: 10, color: colors.foreground }}>QR Code</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>Show this QR code at the venue for entry</Text>
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.foreground }}>${event.price}.00</Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, textDecorationLine: "line-through" }}>${event.originalPrice}.00</Text>
            </View>
            <View style={{ backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start", marginBottom: 24 }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Early Bird Price</Text>
            </View>

            <View style={{ gap: 12, marginBottom: 24 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground }}>Service Fee</Text>
                <Text style={{ color: colors.foreground }}>$3.50</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600", color: colors.foreground }}>Total</Text>
                <Text style={{ fontWeight: "600", color: colors.foreground }}>${(event.price + 3.5).toFixed(2)}</Text>
              </View>
            </View>

            {hasTicket ? (
              <View style={{ backgroundColor: colors.muted, paddingVertical: 16, borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Check size={20} color={colors.foreground} />
                <Text style={{ fontWeight: "600", color: colors.foreground }}>You're Attending</Text>
              </View>
            ) : (
              <Motion.View whileTap={{ scale: 0.98 }}>
                <Pressable
                  onPress={() => toggleRsvp(eventId)}
                  style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "bold", color: "#fff", fontSize: 16 }}>Get Tickets</Text>
                </Pressable>
              </Motion.View>
            )}

            <View style={{ marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Ticket Includes:</Text>
              <View style={{ gap: 8 }}>
                {["Access to all participating venues", "No cover charges", "Exclusive drink specials", "Event wristband"].map((item) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: "#22c55e" }}>✓</Text>
                    <Text style={{ color: colors.mutedForeground }}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  )
}
