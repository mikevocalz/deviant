import { View, Text, Pressable, Platform, ActivityIndicator, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { ChevronRight, Camera, Image as ImageIcon, Mic, Check, X } from "lucide-react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useState, useCallback } from "react"
import * as ImagePicker from "expo-image-picker"
import { Camera as ExpoCamera } from "expo-camera"
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp
} from "react-native-reanimated"
import Onboarding from "@blazejkustra/react-native-onboarding"

type PermissionStatus = "pending" | "granted" | "denied" | "loading"

interface PermissionItem {
  id: string
  title: string
  description: string
  Icon: typeof Camera
  status: PermissionStatus
}

const FEED_IMAGE = require("@/assets/images/onboarding/FEED.jpg")
const VIDEO_IMAGE = require("@/assets/images/onboarding/VIDEO.png")
const EVENTS_IMAGE = require("@/assets/images/onboarding/EVENTS.png")
const PROFILE_IMAGE = require("@/assets/images/onboarding/PROFILE.png")

export default function OnboardingScreen() {
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
      Icon: ImageIcon,
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

  const handleOnboardingComplete = () => {
    setShowPermissions(true)
  }

  const handleOnboardingSkip = () => {
    setShowPermissions(true)
  }

  const handleDone = async () => {
    await setHasSeenOnboarding(true)
    router.replace("/(protected)/(tabs)" as any)
  }

  if (showPermissions) {
    return (
      <LinearGradient colors={["#0f0f1a", "#1a1a2e"]} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionsContainer}>
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.permissionsHeader}>
              <Text style={styles.permissionsTitle}>Enable Permissions</Text>
              <Text style={styles.permissionsSubtitle}>
                To get the best experience, please enable the following permissions
              </Text>
            </Animated.View>

            <View style={styles.permissionsList}>
              {permissions.map((permission, index) => {
                const PermIcon = permission.Icon
                return (
                  <Animated.View 
                    key={permission.id}
                    entering={FadeInUp.delay(200 + index * 100).duration(500)}
                  >
                    <Pressable
                      onPress={() => permission.status === "pending" && handlePermissionRequest(permission.id)}
                      style={styles.permissionItem}
                    >
                      <View style={styles.permissionRow}>
                        <View 
                          style={[
                            styles.permissionIconContainer,
                            { 
                              backgroundColor: permission.status === "granted" 
                                ? "rgba(16, 185, 129, 0.2)" 
                                : permission.status === "denied"
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(138, 64, 207, 0.2)" 
                            }
                          ]}
                        >
                          <PermIcon 
                            size={24} 
                            color={permission.status === "granted" 
                              ? "#10b981" 
                              : permission.status === "denied"
                              ? "#ef4444"
                              : "#8A40CF"} 
                          />
                        </View>
                        <View style={styles.permissionTextContainer}>
                          <Text style={styles.permissionTitle}>
                            {permission.title}
                          </Text>
                          <Text style={styles.permissionDescription}>
                            {permission.description}
                          </Text>
                        </View>
                        <View style={styles.permissionStatusContainer}>
                          {permission.status === "loading" ? (
                            <ActivityIndicator size="small" color="#8A40CF" />
                          ) : permission.status === "granted" ? (
                            <View style={[styles.statusBadge, { backgroundColor: "rgba(16, 185, 129, 0.2)" }]}>
                              <Check size={18} color="#10b981" />
                            </View>
                          ) : permission.status === "denied" ? (
                            <View style={[styles.statusBadge, { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}>
                              <X size={18} color="#ef4444" />
                            </View>
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                              <ChevronRight size={18} color="#fff" />
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                )
              })}
            </View>

            <Animated.View entering={FadeIn.delay(600).duration(500)} style={styles.permissionsActions}>
              {!allPermissionsHandled && (
                <Pressable onPress={requestAllPermissions} style={styles.allowAllButton}>
                  <LinearGradient
                    colors={["#34A2DF", "#8A40CF", "#FF5BFC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.allowAllButtonText}>
                      Allow All Permissions
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
              <Pressable 
                onPress={handleDone}
                style={[
                  styles.continueButton,
                  { backgroundColor: allPermissionsHandled ? "#8A40CF" : "rgba(255,255,255,0.1)" }
                ]}
              >
                <Text 
                  style={[
                    styles.continueButtonText,
                    { color: allPermissionsHandled ? "#fff" : "rgba(255,255,255,0.6)" }
                  ]}
                >
                  {allPermissionsHandled ? "Get Started" : "Skip for Now"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    )
  }

  return (
    <View style={styles.container}>
      <Onboarding
        introPanel={{
          title: "Welcome to DVNT",
          subtitle: "Your creative community awaits. Share moments, discover events, and connect with creators.",
          button: "Get Started",
          image: FEED_IMAGE,
        }}
        steps={[
          {
            title: "Your Feed",
            description: "Discover amazing content from creators you love. Stay updated with posts, stories, and trending moments.",
            buttonLabel: "Next",
            image: FEED_IMAGE,
            position: "top",
          },
          {
            title: "Share Videos",
            description: "Create and share stunning videos with your community. Express yourself through powerful visual storytelling.",
            buttonLabel: "Next",
            image: VIDEO_IMAGE,
            position: "top",
          },
          {
            title: "Discover Events",
            description: "Find exciting events near you and connect with like-minded people. Never miss out on what matters.",
            buttonLabel: "Next",
            image: EVENTS_IMAGE,
            position: "top",
          },
          {
            title: "Your Profile",
            description: "Build your personal brand and showcase your best content. Let the world see who you really are.",
            buttonLabel: "Continue",
            image: PROFILE_IMAGE,
            position: "top",
          },
        ]}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  },
  permissionsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  permissionsHeader: {
    marginBottom: 32,
  },
  permissionsTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  permissionsSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    lineHeight: 24,
  },
  permissionsList: {
    flex: 1,
  },
  permissionItem: {
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  permissionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: 16,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 4,
  },
  permissionDescription: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  permissionStatusContainer: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  permissionsActions: {
    gap: 12,
  },
  allowAllButton: {
    borderRadius: 16,
    overflow: "hidden" as const,
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center" as const,
  },
  allowAllButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center" as const,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
})
