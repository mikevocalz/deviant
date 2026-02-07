import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { toast } from "sonner-native";
import { useForm } from "@tanstack/react-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FormInput } from "@/components/form";
import { Button } from "@/components/ui/button";
import { router, useLocalSearchParams } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { ArrowLeft, Mail } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";

export default function ForgotPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { colors } = useColorScheme();

  const form = useForm({
    defaultValues: { email: emailParam || "" },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);

      try {
        console.log("[ForgotPassword] Sending reset email to:", value.email);

        const { error } = await (authClient as any).forgetPassword({
          email: value.email,
          redirectTo: "dvnt://reset-password",
        });

        if (error) {
          console.error("[ForgotPassword] Error:", error);
          toast.error("Error", {
            description: error.message || "Failed to send reset email",
          });
        } else {
          console.log("[ForgotPassword] Reset email sent successfully");
          setEmailSent(true);
          toast.success("Check Your Email", {
            description: "We've sent you a password reset link",
          });
        }
      } catch (error: any) {
        console.error("[ForgotPassword] Error:", error);
        toast.error("Error", {
          description: error?.message || "Something went wrong",
        });
      }

      setIsSubmitting(false);
    },
  });

  if (emailSent) {
    return (
      <View className="flex-1 bg-background">
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View className="items-center gap-6">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center">
              <Mail size={40} color={colors.primary} />
            </View>

            <View className="items-center gap-2">
              <Text className="text-2xl font-bold text-foreground text-center">
                Check Your Email
              </Text>
              <Text className="text-muted-foreground text-center">
                We've sent a password reset link to your email address. Click
                the link to reset your password.
              </Text>
            </View>

            <View className="w-full gap-3 mt-4">
              <Button onPress={() => router.back()}>Back to Login</Button>

              <Button variant="secondary" onPress={() => setEmailSent(false)}>
                Try Different Email
              </Button>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 60,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8">
          {/* Header */}
          <View className="gap-4">
            <Pressable onPress={() => router.back()} className="self-start">
              <ArrowLeft size={24} color={colors.foreground} />
            </Pressable>

            <View className="gap-2">
              <Text className="text-3xl font-bold text-foreground">
                Forgot Password?
              </Text>
              <Text className="text-muted-foreground">
                Enter your email address and we'll send you a link to reset your
                password.
              </Text>
            </View>
          </View>

          {/* Form */}
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

            <Button
              onPress={form.handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>

            <View className="items-center">
              <Pressable onPress={() => router.back()}>
                <Text className="text-sm text-primary">Back to Login</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
