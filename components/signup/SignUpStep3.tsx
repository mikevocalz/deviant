import { View, Text, ScrollView, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Button, Checkbox } from '@/components/ui'
import { useSignupStore } from '@/lib/stores/signup-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { FileText } from 'lucide-react-native'

export function SignUpStep3() {
  const { 
    formData,
    hasScrolledToBottom, 
    termsAccepted, 
    isSubmitting,
    setActiveStep,
    setHasScrolledToBottom,
    setTermsAccepted,
    setIsSubmitting,
    resetSignup
  } = useSignupStore()
  const { setUser } = useAuthStore()

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
    if (isAtBottom) {
      setHasScrolledToBottom(true)
    }
  }

  const handleSubmit = async () => {
    if (!termsAccepted || !hasScrolledToBottom) return

    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const generatedUsername = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '')
    setUser({
      id: "1",
      email: formData.email,
      username: generatedUsername,
      name: `${formData.firstName} ${formData.lastName}`,
      isVerified: true,
    })
    resetSignup()

    router.replace('/(protected)/onboarding')
  }

  return (
    <View className="gap-6 flex-1">
      <View className="items-center gap-2">
        <View className="h-12 w-12 rounded-full bg-primary/10 items-center justify-center">
          <FileText size={24} className="text-primary" />
        </View>
        <Text className="text-xl font-semibold text-foreground">Terms and Conditions</Text>
        <Text className="text-sm text-muted text-center">
          Please read and accept our terms to complete your registration
        </Text>
      </View>

      <View className="border border-border rounded-lg bg-card" style={{ height: 300 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          bounces={true}
          overScrollMode="always"
        >
          <View style={{ gap: 16 }}>
            <View>
              <Text className="font-semibold text-foreground mb-2">1. Acceptance of Terms</Text>
              <Text className="text-muted text-sm leading-relaxed">
                By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">2. Use License</Text>
              <Text className="text-muted text-sm leading-relaxed">
                Permission is granted to temporarily download one copy of the materials on our service for personal, non-commercial transitory viewing only.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">3. Privacy Policy</Text>
              <Text className="text-muted text-sm leading-relaxed">
                Your privacy is important to us. We collect and process your personal information in accordance with applicable data protection laws.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">4. Identity Verification</Text>
              <Text className="text-muted text-sm leading-relaxed">
                We use identity verification to ensure the security and integrity of our platform. By providing your identification documents and biometric data, you consent to their use for verification purposes.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">5. User Responsibilities</Text>
              <Text className="text-muted text-sm leading-relaxed">
                You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">6. Limitation of Liability</Text>
              <Text className="text-muted text-sm leading-relaxed">
                In no event shall we be liable for any damages arising out of the use or inability to use our service, even if we have been notified of the possibility of such damage.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {!hasScrolledToBottom && (
        <View className="items-center">
          <Text className="text-sm text-muted">Please scroll to the bottom to continue</Text>
        </View>
      )}

      <Pressable
        onPress={() => hasScrolledToBottom && setTermsAccepted(!termsAccepted)}
        className="flex-row items-start gap-3 p-4 rounded-lg border border-border bg-card"
      >
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(v) => hasScrolledToBottom && setTermsAccepted(v)}
        />
        <Text className={`flex-1 text-sm leading-relaxed ${!hasScrolledToBottom ? 'text-muted' : 'text-foreground'}`}>
          I have read and agree to the Terms and Conditions, and I consent to the processing of my personal data including identity verification information.
        </Text>
      </Pressable>

      <View className="flex-row gap-3">
        <Button variant="secondary" onPress={() => setActiveStep(1)} className="flex-1">
          Back
        </Button>
        <Button
          onPress={handleSubmit}
          disabled={!termsAccepted || !hasScrolledToBottom || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Creating Account...' : 'Complete Sign Up'}
        </Button>
      </View>
    </View>
  )
}
