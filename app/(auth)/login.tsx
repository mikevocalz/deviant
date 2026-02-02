import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { toast } from "sonner-native";
import { useForm } from "@tanstack/react-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FormInput } from "@/components/form";
import { Button } from "@/components/ui/button";
import { router } from "expo-router";
import { auth } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import Logo from "@/components/logo";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoLifecycle, logVideoHealth } from "@/lib/video-lifecycle";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function LoginScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUser } = useAuthStore();

  // CRITICAL: Video lifecycle management to prevent crashes
  const { isMountedRef } = useVideoLifecycle("LoginScreen", "background");

  // Background video player
  const backgroundVideo = useVideoPlayer(
    require("@/assets/dvntappbackground.mp4"),
    (player) => {
      if (isMountedRef.current) {
        player.loop = true;
        player.muted = true;
        player.play();
        logVideoHealth("LoginScreen", "background video started");
      }
    },
  );

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);

      try {
        console.log("[Login] Attempting Supabase sign in for:", value.email);
        const result = await auth.signIn(value.email, value.password);
        
        console.log("[Login] Sign in result:", {
          hasUser: !!result.user,
          hasSession: !!result.session,
          hasProfile: !!result.profile,
          userId: result.user?.id,
        });

        if (!result.session || !result.user) {
          console.error("[Login] Missing session or user in result");
          toast.error("Login Failed", {
            description: "Invalid credentials",
          });
          setIsSubmitting(false);
          return;
        }

        console.log("[Login] Sign in successful, user:", result.user.id);
        
        // Update auth store with profile
        if (result.profile) {
          console.log("[Login] Setting user in store:", result.profile.id);
          setUser(result.profile);
        } else {
          console.warn("[Login] No profile found for user");
        }

        toast.success("Welcome back!", {
          description: "Signed in successfully",
        });

        // Navigate to app
        console.log("[Login] Navigating to protected tabs");
        setTimeout(() => {
          router.replace("/(protected)/(tabs)" as any);
        }, 100);
      } catch (error: any) {
        console.error("[Login] Error:", error);
        console.error("[Login] Error message:", error?.message);
        console.error("[Login] Error details:", JSON.stringify(error, null, 2));

        let errorMessage = "Invalid credentials";
        if (error?.message) {
          errorMessage = error.message;
        }

        // Network error
        if (
          errorMessage.includes("fetch") ||
          errorMessage.includes("network") ||
          errorMessage.includes("Failed to fetch")
        ) {
          toast.error("Connection Error", {
            description: "Unable to connect to server. Please try again later.",
          });
        } else {
          toast.error("Login Failed", {
            description: errorMessage,
          });
        }
      }

      setIsSubmitting(false);
    },
  });

  return (
    <View style={styles.container}>
      {/* Background Video */}
      <VideoView
        player={backgroundVideo}
        style={styles.backgroundVideo}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Gradient overlay - transparent at top, black at bottom (starts at 47%) */}
      <LinearGradient
        colors={[
          "transparent",
          "transparent",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.7)",
          "#000",
        ]}
        locations={[0, 0.47, 0.6, 0.8, 1]}
        style={styles.overlay}
      />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
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
          {/* <Logo width={200} height={80} /> */}
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
            labelClassName="text-white"
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
            labelClassName="text-white"
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

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="self-center">
            <Text className="text-sm text-primary">Forgot Password?</Text>
          </Pressable>
        </View>

        <View className="items-center gap-2">
          <View className="flex-row items-center gap-2 w-full">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-muted-foreground text-xs">Or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          <View className="gap-4">
            <FormInput
              form={form}
              name="email"
              label="Email"
              labelClassName="text-white"
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
              labelClassName="text-white"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
