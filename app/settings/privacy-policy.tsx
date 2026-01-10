import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

export default function PrivacyPolicyScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Privacy Policy</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-2 text-xs text-muted-foreground">Last updated: January 2025</Text>

          <Text className="mb-4 text-2xl font-bold">Privacy Policy</Text>

          <Text className="mb-6 text-base leading-6 text-foreground/90">
            Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our social networking application.
          </Text>

          <Text className="mb-2 text-lg font-semibold">1. Information We Collect</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            We collect information that you provide directly to us, including your name, email address, profile
            information, posts, comments, and messages. We also collect information about your usage of the app and
            device information.
          </Text>

          <Text className="mb-2 text-lg font-semibold">2. How We Use Your Information</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            We use the information we collect to provide, maintain, and improve our services, to communicate with you,
            to monitor and analyze trends and usage, and to personalize your experience.
          </Text>

          <Text className="mb-2 text-lg font-semibold">3. Information Sharing</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            We do not sell your personal information. We may share your information with service providers, for legal
            reasons, or with your consent.
          </Text>

          <Text className="mb-2 text-lg font-semibold">4. Data Security</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            We implement appropriate technical and organizational measures to protect your personal information.
            However, no method of transmission over the internet is 100% secure.
          </Text>

          <Text className="mb-2 text-lg font-semibold">5. Your Rights</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            You have the right to access, update, or delete your personal information. You can manage your account
            settings or contact us for assistance.
          </Text>

          <Text className="mb-2 text-lg font-semibold">6. Contact Us</Text>
          <Text className="mb-6 text-base leading-6 text-foreground/90">
            If you have any questions about this Privacy Policy, please contact us at privacy@socialapp.com
          </Text>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
