import { View, Text, Pressable, Dimensions, Platform, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Users, Heart, Share2, Shield, ChevronRight, Camera, Image, Mic, Check, X } from "lucide-react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { useSharedValue, withSpring } from "react-native-reanimated"
import { useState, useCallback } from "react"
import * as ImagePicker from "expo-image-picker"
import { Camera as ExpoCamera } from "expo-camera"

const { width } = Dimensions.get("window")

type PermissionStatus = "pending" | "granted" | "denied" | "loading"

interface PermissionItem {
  id: string
  title: string
  description: string
  Icon: typeof Camera
  status: PermissionStatus
}

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
  const [showPermissions, setShowPermissions] = useState(false)
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: "camera",
      title: "Camera",
      description: "Take photos and videos to share",
      Icon: Camera,
      status: "pending",
    },
    {
      id: "photos",
      title: "Photo Library",
      description: "Access your photos and videos",
      Icon: Image,
      status: "pending",
    },
    {
      id: "microphone",
      title: "Microphone",
      description: "Record audio for videos and stories",
      Icon: Mic,
      status: "pending",
    },
  ])

  const updatePermissionStatus = useCallback((id: string, status: PermissionStatus) => {
    setPermissions(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }, [])

  const requestCameraPermission = useCallback(async () => {
    updatePermissionStatus("camera", "loading")
    try {
      if (Platform.OS === "web") {
        updatePermissionStatus("camera", "granted")
        return
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      updatePermissionStatus("camera", status === "granted" ? "granted" : "denied")
    } catch (error) {
      console.log("Camera permission error:", error)
      updatePermissionStatus("camera", "denied")
    }
  }, [updatePermissionStatus])

  const requestPhotosPermission = useCallback(async () => {
    updatePermissionStatus("photos", "loading")
    try {
      if (Platform.OS === "web") {
        updatePermissionStatus("photos", "granted")
        return
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      updatePermissionStatus("photos", status === "granted" ? "granted" : "denied")
    } catch (error) {
      console.log("Photos permission error:", error)
      updatePermissionStatus("photos", "denied")
    }
  }, [updatePermissionStatus])

  const requestMicrophonePermission = useCallback(async () => {
    updatePermissionStatus("microphone", "loading")
    try {
      if (Platform.OS === "web") {
        updatePermissionStatus("microphone", "granted")
        return
      }
      const { status } = await ExpoCamera.requestMicrophonePermissionsAsync()
      updatePermissionStatus("microphone", status === "granted" ? "granted" : "denied")
    } catch (error) {
      console.log("Microphone permission error:", error)
      updatePermissionStatus("microphone", "denied")
    }
  }, [updatePermissionStatus])

  const requestAllPermissions = useCallback(async () => {
    await requestCameraPermission()
    await requestPhotosPermission()
    await requestMicrophonePermission()
  }, [requestCameraPermission, requestPhotosPermission, requestMicrophonePermission])

  const handlePermissionRequest = useCallback(async (id: string) => {
    switch (id) {
      case "camera":
        await requestCameraPermission()
        break
      case "photos":
        await requestPhotosPermission()
        break
      case "microphone":
        await requestMicrophonePermission()
        break
    }
  }, [requestCameraPermission, requestPhotosPermission, requestMicrophonePermission])

  const allPermissionsHandled = permissions.every(p => p.status === "granted" || p.status === "denied")

  const handleNext = () => {
    if (currentIndex < ONBOARDING_PAGES.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      scrollX.value = withSpring(nextIndex * width)
    } else {
      setShowPermissions(true)
    }
  }

  const handleSkip = () => {
    setShowPermissions(true)
  }

  const handleDone = async () => {
    await setHasSeenOnboarding(true)
    router.replace("/(protected)/(tabs)" as any)
  }

  const currentPage = ONBOARDING_PAGES[currentIndex]
  const PageIcon = currentPage.Icon

  if (showPermissions) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e"]} className="flex-1">
        <SafeAreaView className="flex-1">
          <View className="flex-1 px-6 py-8">
            <View className="mb-8">
              <Text className="text-white text-3xl font-display-bold mb-2">Enable Permissions</Text>
              <Text className="text-white/70 text-base font-sans leading-6">
                To get the best experience, please enable the following permissions
              </Text>
            </View>

            <View className="flex-1">
              {permissions.map((permission, index) => {
                const PermIcon = permission.Icon
                return (
                  <Pressable
                    key={permission.id}
                    onPress={() => permission.status === "pending" && handlePermissionRequest(permission.id)}
                    className="mb-4"
                  >
                    <View 
                      className="flex-row items-center p-4 rounded-2xl"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <View 
                        className="w-12 h-12 rounded-full items-center justify-center mr-4"
                        style={{ 
                          backgroundColor: permission.status === "granted" 
                            ? "rgba(16, 185, 129, 0.2)" 
                            : permission.status === "denied"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(99, 102, 241, 0.2)" 
                        }}
                      >
                        <PermIcon 
                          size={24} 
                          color={permission.status === "granted" 
                            ? "#10b981" 
                            : permission.status === "denied"
                            ? "#ef4444"
                            : "#6366f1"} 
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-sans-semibold text-base mb-1">
                          {permission.title}
                        </Text>
                        <Text className="text-white/60 font-sans text-sm">
                          {permission.description}
                        </Text>
                      </View>
                      <View className="w-10 h-10 items-center justify-center">
                        {permission.status === "loading" ? (
                          <ActivityIndicator size="small" color="#6366f1" />
                        ) : permission.status === "granted" ? (
                          <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                            <Check size={18} color="#10b981" />
                          </View>
                        ) : permission.status === "denied" ? (
                          <View className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center">
                            <X size={18} color="#ef4444" />
                          </View>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                            <ChevronRight size={18} color="#fff" />
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <View className="gap-3">
              {!allPermissionsHandled && (
                <Pressable onPress={requestAllPermissions}>
                  <View className="bg-indigo-500 rounded-2xl py-4 px-6">
                    <Text className="text-white text-lg font-sans-bold text-center">
                      Allow All Permissions
                    </Text>
                  </View>
                </Pressable>
              )}
              <Pressable onPress={handleDone}>
                <View 
                  className="rounded-2xl py-4 px-6"
                  style={{ backgroundColor: allPermissionsHandled ? "#6366f1" : "rgba(255,255,255,0.1)" }}
                >
                  <Text 
                    className="text-lg font-sans-bold text-center"
                    style={{ color: allPermissionsHandled ? "#fff" : "rgba(255,255,255,0.6)" }}
                  >
                    {allPermissionsHandled ? "Get Started" : "Skip for Now"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    )
  }

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
              <PageIcon size={64} color="#fff" />
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
                  {currentIndex === ONBOARDING_PAGES.length - 1 ? "Continue" : "Next"}
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
