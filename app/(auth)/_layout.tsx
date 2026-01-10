import { Stack } from "expo-router"
import { KeyboardProvider } from "react-native-keyboard-controller"

export default function AuthLayout() {
  return (
    <KeyboardProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </KeyboardProvider>
  )
}
