import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"

export default function CommunityGuidelinesScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Community Guidelines</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-4 text-sm text-muted-foreground">Last updated: January 2024</Text>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Our Mission</Text>
            <Text className="leading-relaxed text-foreground">
              We're building a safe, inclusive community where everyone can express themselves authentically. These
              guidelines help us maintain a positive environment for all users.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Be Respectful</Text>
            <Text className="leading-relaxed text-foreground">
              Treat others with kindness and respect. Harassment, hate speech, bullying, and discrimination have no
              place in our community.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Share Authentic Content</Text>
            <Text className="leading-relaxed text-foreground">
              Post original content that you have the rights to share. Give credit where credit is due. Misinformation
              and impersonation are not allowed.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Protect Privacy</Text>
            <Text className="leading-relaxed text-foreground">
              Respect others' privacy. Don't share personal information about others without their consent. Report any
              privacy violations you encounter.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Keep it Safe</Text>
            <Text className="leading-relaxed text-foreground">
              We prohibit content that promotes violence, illegal activities, self-harm, or exploitation. Report
              concerning content immediately.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Age Requirements</Text>
            <Text className="leading-relaxed text-foreground">
              Users must be 13 years or older. Users under 18 require parental consent and have additional privacy
              protections.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Enforcement</Text>
            <Text className="leading-relaxed text-foreground">
              Violations may result in content removal, account warnings, temporary suspension, or permanent ban
              depending on severity. We review reports within 24-48 hours.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Report Violations</Text>
            <Text className="leading-relaxed text-foreground">
              If you see something that violates these guidelines, please report it using the in-app reporting tools or
              contact our support team.
            </Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
