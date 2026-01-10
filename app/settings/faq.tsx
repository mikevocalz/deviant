import { View, Text, ScrollView, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Main } from "@expo/html-elements"
import { useRouter } from "expo-router"
import { ChevronLeft, ChevronDown } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { useFAQStore } from "@/lib/stores/faq-store"

const faqs = [
  {
    question: "How do I create an account?",
    answer:
      "Tap the Sign Up button on the login screen, provide your email, name, and password, verify your age, and agree to our terms.",
  },
  {
    question: "How do I reset my password?",
    answer: "On the login screen, tap 'Forgot Password' and follow the instructions sent to your email address.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Go to Settings > Account Information > Delete Account. Note that this action is permanent and cannot be undone.",
  },
  {
    question: "How do I report inappropriate content?",
    answer:
      "Tap the three dots on any post or profile, select 'Report', and choose the reason for reporting. Our team will review it.",
  },
  {
    question: "How do I make my account private?",
    answer: "Go to Settings > Privacy and toggle 'Private Account'. Only approved followers will see your posts.",
  },
  {
    question: "Can I recover deleted posts?",
    answer:
      "Deleted posts are permanently removed after 30 days. Within that period, you can find them in Settings > Archived.",
  },
]

export default function FAQScreen() {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { expandedIndex, toggleExpanded } = useFAQStore()

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Main className="flex-1">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold">Help Center / FAQ</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
          <Text className="mb-6 text-2xl font-bold">Frequently Asked Questions</Text>

          {faqs.map((faq, index) => (
            <View key={index} className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
              <Pressable
                onPress={() => toggleExpanded(index)}
                className="flex-row items-center justify-between p-4 active:bg-secondary"
              >
                <Text className="flex-1 pr-2 font-semibold">{faq.question}</Text>
                <ChevronDown
                  size={20}
                  color="#666"
                  style={{
                    transform: [{ rotate: expandedIndex === index ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>
              {expandedIndex === index && (
                <View className="border-t border-border bg-secondary/50 p-4">
                  <Text className="leading-6 text-foreground/90">{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}

          <View className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Text className="mb-2 font-semibold">Still need help?</Text>
            <Text className="text-sm text-muted-foreground">Contact our support team at support@socialapp.com</Text>
          </View>
        </ScrollView>
      </Main>
    </SafeAreaView>
  )
}
