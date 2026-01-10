import { View, Text, Pressable, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Link, router } from "expo-router"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useLoginStore } from "@/lib/stores/login-store"
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { LinearGradient } from "expo-linear-gradient"

export default function LoginScreen() {
  const email = useLoginStore((state) => state.email)
  const password = useLoginStore((state) => state.password)
  const showPassword = useLoginStore((state) => state.showPassword)
  const isLoading = useLoginStore((state) => state.isLoading)
  const setEmail = useLoginStore((state) => state.setEmail)
  const setPassword = useLoginStore((state) => state.setPassword)
  const toggleShowPassword = useLoginStore((state) => state.toggleShowPassword)
  const setIsLoading = useLoginStore((state) => state.setIsLoading)
  const setUser = useAuthStore((state) => state.setUser)

  const handleLogin = async () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setUser({
        id: "1",
        email,
        name: "John Doe",
        isVerified: true,
      })
      setIsLoading(false)
      router.replace("/(protected)/(tabs)")
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
          {/* Logo/Header */}
          <View className="items-center mb-12">
            <LinearGradient
              colors={["#6366f1", "#ec4899", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
            >
              <Text className="text-white text-4xl font-display-bold">P</Text>
            </LinearGradient>
            <Text className="text-3xl font-display-bold text-foreground">Welcome Back</Text>
            <Text className="text-muted-foreground mt-2">Sign in to continue</Text>
          </View>

          {/* Login Form */}
          <View className="space-y-4">
            {/* Email Input */}
            <View>
              <Text className="text-sm font-sans-semibold text-foreground mb-2">Email</Text>
              <View className="flex-row items-center bg-muted rounded-xl px-4 py-3">
                <Mail size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-3 text-foreground font-sans"
                  placeholder="Enter your email"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-sm font-sans-semibold text-foreground mb-2">Password</Text>
              <View className="flex-row items-center bg-muted rounded-xl px-4 py-3">
                <Lock size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-3 text-foreground font-sans"
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                />
                <Pressable onPress={toggleShowPassword}>
                  {showPassword ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                </Pressable>
              </View>
            </View>

            {/* Forgot Password */}
            <Pressable className="self-end">
              <Text className="text-primary font-sans-semibold">Forgot Password?</Text>
            </Pressable>

            {/* Login Button */}
            <Pressable onPress={handleLogin} disabled={isLoading} className="mt-6">
              <LinearGradient
                colors={["#6366f1", "#ec4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="rounded-xl py-4 items-center"
              >
                <Text className="text-white font-sans-bold text-lg">{isLoading ? "Signing in..." : "Sign In"}</Text>
              </LinearGradient>
            </Pressable>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-muted-foreground font-sans">Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable>
                  <Text className="text-primary font-sans-bold">Sign Up</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}
