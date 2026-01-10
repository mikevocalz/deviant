import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

export default function TermsScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Terms of Service</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-2 text-xs text-muted-foreground">Last updated: January 2025</Text>

          <Text className="mb-4 text-2xl font-bold">Terms of Service</Text>

          <Text className="mb-6 text-base leading-6 text-foreground/90">
            By accessing or using our social networking application, you agree to be bound by these Terms of Service.
          </Text>

          <Text className="mb-2 text-lg font-semibold">1. Acceptance of Terms</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            By creating an account and using our services, you accept and agree to be bound by these Terms of Service
            and our Privacy Policy.
          </Text>

          <Text className="mb-2 text-lg font-semibold">2. User Accounts</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            You must be at least 13 years old to use our service. You are responsible for maintaining the
            confidentiality of your account and password.
          </Text>

          <Text className="mb-2 text-lg font-semibold">3. User Content</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            You retain all rights to the content you post. By posting content, you grant us a license to use, reproduce,
            and display your content in connection with the service.
          </Text>

          <Text className="mb-2 text-lg font-semibold">4. Prohibited Conduct</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            You may not use our service to post illegal, harmful, threatening, abusive, harassing, defamatory, or
            otherwise objectionable content.
          </Text>

          <Text className="mb-2 text-lg font-semibold">5. Termination</Text>
          <Text className="mb-4 text-base leading-6 text-foreground/90">
            We reserve the right to suspend or terminate your account at any time for any reason, including violation of
            these Terms.
          </Text>

          <Text className="mb-2 text-lg font-semibold">6. Limitation of Liability</Text>
          <Text className="mb-6 text-base leading-6 text-foreground/90">
            Our service is provided "as is" without warranties of any kind. We shall not be liable for any indirect,
            incidental, or consequential damages.
          </Text>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
