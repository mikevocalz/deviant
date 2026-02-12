import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { useForm } from "@tanstack/react-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FormInput } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  router,
  useLocalSearchParams,
  useGlobalSearchParams,
} from "expo-router";
import { authClient, getSession } from "@/lib/auth-client";
import { Check } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import * as Linking from "expo-linking";

export default function ResetPasswordScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const { colors } = useColorScheme();

  // Get params from deep link or route
  const params = useGlobalSearchParams();

  // Validate the reset token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        if (__DEV__) console.log("[ResetPassword] Params:", params);

        // Check if we have a valid session (should be set by deep link handler)
        const session = await getSession();
        const sessionError = !session;

        if (sessionError) {
          console.error("[ResetPassword] Session error:", sessionError);
          toast.error("Invalid Link", {
            description:
              "This password reset link is invalid or expired. Please request a new one.",
          });
          setTimeout(() => {
            router.replace("/(auth)/forgot-password");
          }, 2000);
          return;
        }

        if (!session) {
          console.error("[ResetPassword] No session found");
          if (__DEV__)
            console.log(
              "[ResetPassword] This usually means the deep link wasn't properly handled",
            );
          toast.error("Session Missing", {
            description: "Please request a new password reset link.",
          });
          setTimeout(() => {
            router.replace("/(auth)/forgot-password");
          }, 2000);
          return;
        }

        if (__DEV__)
          console.log(
            "[ResetPassword] Valid session found, user can reset password",
          );
        setIsValidating(false);
      } catch (error) {
        console.error("[ResetPassword] Validation error:", error);
        toast.error("Error", {
          description: "Something went wrong. Please try again.",
        });
        setTimeout(() => {
          router.replace("/(auth)/forgot-password");
        }, 2000);
      }
    };

    validateToken();
  }, [params]);

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);

      try {
        if (__DEV__) console.log("[ResetPassword] Updating password...");

        const { error } = await authClient.resetPassword({
          newPassword: value.password,
        });

        if (error) {
          console.error("[ResetPassword] Error:", error);
          toast.error("Error", {
            description: error.message || "Failed to reset password",
          });
          setIsSubmitting(false);
          return;
        }

        if (__DEV__)
          console.log("[ResetPassword] Password updated successfully");
        setResetComplete(true);
        toast.success("Success!", {
          description: "Your password has been reset",
        });

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 2000);
      } catch (error: any) {
        console.error("[ResetPassword] Error:", error);
        toast.error("Error", {
          description: error?.message || "Something went wrong",
        });
      }

      setIsSubmitting(false);
    },
  });

  if (isValidating) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Validating reset link...</Text>
      </View>
    );
  }

  if (resetComplete) {
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
              <Check size={40} color={colors.primary} />
            </View>

            <View className="items-center gap-2">
              <Text className="text-2xl font-bold text-foreground text-center">
                Password Reset!
              </Text>
              <Text className="text-muted-foreground text-center">
                Your password has been successfully reset. Redirecting to
                login...
              </Text>
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
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Reset Password
            </Text>
            <Text className="text-muted-foreground">
              Enter your new password below
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <FormInput
              form={form}
              name="password"
              label="New Password"
              placeholder="Enter new password"
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

            <FormInput
              form={form}
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Re-enter new password"
              secureTextEntry
              validators={{
                onChangeListenTo: ["password"],
                onChange: ({ value, fieldApi }: any) => {
                  const pwd = fieldApi.form.getFieldValue("password");
                  if (!value) return "Please confirm your password";
                  if (value !== pwd) return "Passwords do not match";
                  return undefined;
                },
              }}
            />

            <Button
              onPress={form.handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              className="mt-4"
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
