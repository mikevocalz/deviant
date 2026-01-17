import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useForm } from '@tanstack/react-form'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { FormInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Lock } from 'lucide-react-native'
import Logo from '@/components/logo'

export default function LoginScreen() {
  const setUser = useAuthStore((state) => state.setUser)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (value.email && value.password) {
        setUser({
          id: "1",
          email: value.email,
          username: "alex.creator",
          name: "Alex Thompson",
          isVerified: true,
        })
        router.replace('/(protected)/(tabs)' as any)
      }

      setIsSubmitting(false)
    },
  })

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
        <View className="gap-6">
          <View className="items-center gap-8">
              <Logo width={200} height={80} />
            <View className="items-center my-8">
              <Text className="text-3xl font-bold text-foreground">
                Welcome back
              </Text>
              <Text className="text-muted-foreground mt-4">
                Sign in to your account to continue
              </Text>
            </View>
          </View>

          <View className="gap-4">
            <FormInput
              form={form}
              name="email"
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              validators={{
                onChange: ({ value }: any) => {
                  if (!value) return "Email is required";
                  if (!value.includes("@")) return "Please enter a valid email";
                  return undefined;
                },
              }}
            />

            <FormInput
              form={form}
              name="password"
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              validators={{
                onChange: ({ value }: any) => {
                  if (!value) return "Password is required";
                  if (value.length < 8)
                    return "Password must be at least 8 characters";
                  return undefined;
                },
              }}
            />

            <Button
              onPress={form.handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </View>

          <View className="items-center gap-2">
            <View className="flex-row items-center gap-2 w-full">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground text-xs">Or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <View className="flex-row items-center gap-1">
              <Text className="text-muted-foreground">
                Don't have an account?
              </Text>
              <Pressable onPress={() => router.push("/(auth)/signup" as any)}>
                <Text className="text-primary font-medium">Sign up</Text>
              </Pressable>
            </View>
          </View>
        </View>
    </KeyboardAwareScrollView>
  );
}
