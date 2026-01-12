import { Stack, Redirect } from "expo-router"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function AuthLayout() {
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding)

  return (
    <KeyboardProvider>
      <Stack 
        screenOptions={{ headerShown: false }}
        initialRouteName={hasSeenOnboarding ? "login" : "onboarding"}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </KeyboardProvider>
  )
}
