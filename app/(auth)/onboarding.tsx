import { View, Text, Pressable, Dimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Users, Heart, Share2, Shield, ChevronRight } from "lucide-react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { useSharedValue, withSpring } from "react-native-reanimated"

const { width } = Dimensions.get("window")

const ONBOARDING_PAGES = [
  {
    colors: ["#6366f1", "#8b5cf6"],
    Icon: Users,
    title: "Connect with Friends",
    subtitle: "Share your moments and stay connected with people you care about",
  },
  {
    colors: ["#ec4899", "#f472b6"],
    Icon: Heart,
    title: "Express Yourself",
    subtitle: "Share photos, videos, and stories that matter to you",
  },
  {
    colors: ["#a855f7", "#c084fc"],
    Icon: Share2,
    title: "Discover & Explore",
    subtitle: "Find new content and connect with like-minded people",
  },
  {
    colors: ["#10b981", "#34d399"],
    Icon: Shield,
    title: "Safe & Secure",
    subtitle: "Your privacy and security are our top priorities",
  },
]

export default function OnboardingScreen() {
  const { currentIndex, setCurrentIndex } = useOnboardingStore()
  const scrollX = useSharedValue(0)
  const setHasSeenOnboarding = useAuthStore((state) => state.setHasSeenOnboarding)

  const handleNext = () => {
    if (currentIndex < ONBOARDING_PAGES.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      scrollX.value = withSpring(nextIndex * width)
    } else {
      handleDone()
    }
  }

  const handleSkip = () => {
    handleDone()
  }

  const handleDone = async () => {
    await setHasSeenOnboarding(true)
    router.replace("/(protected)/(tabs)" as any)
  }

  const currentPage = ONBOARDING_PAGES[currentIndex]
  const Icon = currentPage.Icon

  return (
    <LinearGradient colors={currentPage.colors as [string, string]} className="flex-1">
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 justify-between py-12">
          {/* Skip Button */}
          <View className="items-end">
            <Pressable onPress={handleSkip}>
              <Text className="text-white/80 font-sans-semibold text-base">Skip</Text>
            </Pressable>
          </View>

          {/* Content */}
          <View className="items-center">
            <View className="w-32 h-32 bg-white/20 rounded-full items-center justify-center mb-8">
              <Icon size={64} color="#fff" />
            </View>
            <Text className="text-white text-3xl font-display-bold text-center mb-4">{currentPage.title}</Text>
            <Text className="text-white/90 text-lg font-sans text-center leading-7">{currentPage.subtitle}</Text>
          </View>

          {/* Pagination & Button */}
          <View>
            {/* Dots */}
            <View className="flex-row justify-center mb-8 gap-2">
              {ONBOARDING_PAGES.map((_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full ${index === currentIndex ? "w-8 bg-white" : "w-2 bg-white/40"}`}
                />
              ))}
            </View>

            {/* Next Button */}
            <Pressable onPress={handleNext}>
              <View className="bg-white rounded-2xl py-4 px-6 flex-row items-center justify-center">
                <Text className="text-lg font-sans-bold mr-2" style={{ color: currentPage.colors[0] }}>
                  {currentIndex === ONBOARDING_PAGES.length - 1 ? "Get Started" : "Next"}
                </Text>
                <ChevronRight size={20} color={currentPage.colors[0]} />
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}
