import { View, Text, Pressable, TextInput, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { User, Mail, Lock, Calendar, CheckCircle } from "lucide-react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { LinearGradient } from "expo-linear-gradient"

import { useEffect } from "react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useSignupStore } from "@/lib/stores/signup-store"

export default function SignupScreen() {
  const currentStep = useSignupStore((state) => state.currentStep)
  const formData = useSignupStore((state) => state.formData)
  const hasScrolledToBottom = useSignupStore((state) => state.hasScrolledToBottom)
  const setCurrentStep = useSignupStore((state) => state.setCurrentStep)
  const updateFormData = useSignupStore((state) => state.updateFormData)
  const setHasScrolledToBottom = useSignupStore((state) => state.setHasScrolledToBottom)
  const setUser = useAuthStore((state) => state.setUser)
  const resetSignup = useSignupStore((state) => state.resetSignup)

  // Reset signup state when entering screen
  useEffect(() => {
    resetSignup()
  }, [resetSignup])

  const handleScanID = async () => {
    try {
      // Simulate successful scanning
      setTimeout(() => {
        updateFormData({
          idVerified: true,
          dateOfBirth: "1995-03-15", // Extracted from ID
        })
      }, 2000)
    } catch (error) {
      console.error("ID scanning error:", error)
    }
  }

  const handleSignup = async () => {
    // Simulate API call
    setTimeout(() => {
      setUser({
        id: "1",
        email: formData.email,
        name: formData.name,
        isVerified: formData.idVerified,
      })
      router.replace("/(auth)/onboarding" as any)
    }, 1500)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="items-center mb-8">
            <LinearGradient
              colors={["#6366f1", "#ec4899", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
            >
              <Text className="text-white text-4xl font-display-bold">P</Text>
            </LinearGradient>
            <Text className="text-3xl font-display-bold text-foreground">Create Account</Text>
            <Text className="text-muted-foreground mt-2">Step {currentStep + 1} of 3</Text>
          </View>

          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-sans-semibold text-foreground mb-2">Full Name</Text>
                <View className="flex-row items-center bg-muted rounded-xl px-4 py-3">
                  <User size={20} color="#6b7280" />
                  <TextInput
                    className="flex-1 ml-3 text-foreground font-sans"
                    placeholder="Enter your full name"
                    placeholderTextColor="#9ca3af"
                    value={formData.name}
                    onChangeText={(text) => updateFormData({ name: text })}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm font-sans-semibold text-foreground mb-2">Email</Text>
                <View className="flex-row items-center bg-muted rounded-xl px-4 py-3">
                  <Mail size={20} color="#6b7280" />
                  <TextInput
                    className="flex-1 ml-3 text-foreground font-sans"
                    placeholder="Enter your email"
                    placeholderTextColor="#9ca3af"
                    value={formData.email}
                    onChangeText={(text) => updateFormData({ email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm font-sans-semibold text-foreground mb-2">Password</Text>
                <View className="flex-row items-center bg-muted rounded-xl px-4 py-3">
                  <Lock size={20} color="#6b7280" />
                  <TextInput
                    className="flex-1 ml-3 text-foreground font-sans"
                    placeholder="Create a password"
                    placeholderTextColor="#9ca3af"
                    value={formData.password}
                    onChangeText={(text) => updateFormData({ password: text })}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Pressable onPress={() => setCurrentStep(1)} className="mt-6">
                <LinearGradient
                  colors={["#6366f1", "#ec4899"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="rounded-xl py-4 items-center"
                >
                  <Text className="text-white font-sans-bold text-lg">Continue</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* Step 2: ID Verification */}
          {currentStep === 1 && (
            <View className="space-y-4">
              <View className="bg-muted rounded-2xl p-6 items-center">
                <Calendar size={64} color="#6366f1" />
                <Text className="text-xl font-display-bold text-foreground mt-4">Verify Your Age</Text>
                <Text className="text-muted-foreground text-center mt-2">
                  Scan your ID to confirm you&apos;re 18 or older
                </Text>

                {formData.idVerified ? (
                  <View className="mt-6 items-center">
                    <CheckCircle size={48} color="#10b981" />
                    <Text className="text-lg font-sans-bold text-green-600 mt-2">ID Verified!</Text>
                    <Text className="text-muted-foreground mt-1">Date of Birth: {formData.dateOfBirth}</Text>
                  </View>
                ) : (
                  <Pressable onPress={handleScanID} className="mt-6 w-full">
                    <View className="bg-primary rounded-xl py-4 items-center">
                      <Text className="text-white font-sans-bold text-lg">Scan ID</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              <View className="flex-row gap-3">
                <Pressable onPress={() => setCurrentStep(0)} className="flex-1">
                  <View className="bg-muted rounded-xl py-4 items-center">
                    <Text className="text-foreground font-sans-bold">Back</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => setCurrentStep(2)} disabled={!formData.idVerified} className="flex-1">
                  <LinearGradient
                    colors={formData.idVerified ? ["#6366f1", "#ec4899"] : ["#9ca3af", "#6b7280"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="rounded-xl py-4 items-center"
                  >
                    <Text className="text-white font-sans-bold">Continue</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 3: Terms & Conditions */}
          {currentStep === 2 && (
            <View className="flex-1">
              <Text className="text-xl font-display-bold text-foreground mb-4">Terms & Conditions</Text>

              <ScrollView
                className="flex-1 bg-muted rounded-2xl p-4 mb-4"
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
                  const isBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20
                  if (isBottom) setHasScrolledToBottom(true)
                }}
                scrollEventThrottle={16}
              >
                <Text className="text-foreground font-sans leading-6">
                  {/* Terms content would be loaded from a separate file */}
                  By using Pulse, you agree to our Terms of Service and Privacy Policy...
                  {"\n\n"}
                  [Full terms and conditions would be displayed here]
                  {"\n\n"}
                  Please scroll to the bottom to continue.
                </Text>
              </ScrollView>

              <Pressable
                onPress={() => updateFormData({ termsAccepted: !formData.termsAccepted })}
                className="flex-row items-center mb-4"
              >
                <View
                  className={`w-6 h-6 rounded-md border-2 ${formData.termsAccepted ? "bg-primary border-primary" : "border-muted-foreground"} items-center justify-center mr-3`}
                >
                  {formData.termsAccepted && <CheckCircle size={16} color="#fff" />}
                </View>
                <Text className="flex-1 text-foreground font-sans">
                  I have read and agree to the Terms & Conditions
                </Text>
              </Pressable>

              <View className="flex-row gap-3">
                <Pressable onPress={() => setCurrentStep(1)} className="flex-1">
                  <View className="bg-muted rounded-xl py-4 items-center">
                    <Text className="text-foreground font-sans-bold">Back</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={handleSignup}
                  disabled={!hasScrolledToBottom || !formData.termsAccepted}
                  className="flex-1"
                >
                  <LinearGradient
                    colors={
                      hasScrolledToBottom && formData.termsAccepted ? ["#6366f1", "#ec4899"] : ["#9ca3af", "#6b7280"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="rounded-xl py-4 items-center"
                  >
                    <Text className="text-white font-sans-bold">Complete</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
