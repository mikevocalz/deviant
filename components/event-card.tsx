import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { Heart, Share2, Bookmark } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Motion } from "@legendapp/motion";
import Animated, {
  useAnimatedStyle,
  FadeInDown,
} from "react-native-reanimated";
import { AVATAR_COLORS } from "@/lib/constants/events";
import { useRouter } from "expo-router";
import { useResponsiveMedia } from "@/lib/hooks/use-responsive-media";

export function EventCard({ event, index, scrollY, formatLikes }: any) {
  const router = useRouter();

  // Responsive sizing: full width on phone, max 614px centered on tablet
  const {
    width: cardWidth,
    height: CARD_HEIGHT,
    containerClass,
  } = useResponsiveMedia("square"); // 1:1 aspect ratio for events
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
      className={containerClass}
    >
      <Motion.View
        className="rounded-3xl overflow-hidden mb-5"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
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
                  className="w-10 h-10 rounded-xl border-2 border-background justify-center items-center overflow-hidden"
                  style={{
                    marginLeft: idx === 0 ? 0 : -12,
                    backgroundColor: attendee.initials
                      ? AVATAR_COLORS[idx % 5]
                      : "transparent",
                  }}
                >
                  {attendee.image ? (
                    <Image
                      source={{ uri: attendee.image }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <Text className="text-white text-xs font-semibold">
                      {attendee.initials}
                    </Text>
                  )}
                </View>
              ))}
              <View className="ml-2 bg-black/40 px-2 py-1 rounded-xl">
                <Text className="text-white text-xs font-medium">
                  +{event.totalAttendees - event.attendees.length}
                </Text>
              </View>
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
                {event.time} • {event.totalAttendees} participants
              </Text>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <Pressable className="flex-row items-center gap-1.5 bg-white/20 px-4 py-2 rounded-full">
                    <Heart size={16} color="#fff" />
                    <Text className="text-white text-sm font-medium">
                      {formatLikes(event.likes)}
                    </Text>
                  </Pressable>
                  <Pressable className="bg-white/20 p-2 rounded-full">
                    <Share2 size={16} color="#fff" />
                  </Pressable>
                  <Pressable className="bg-white/20 p-2 rounded-full">
                    <Bookmark size={16} color="#fff" />
                  </Pressable>
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
