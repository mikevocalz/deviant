import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { toast } from "sonner-native";
import { useForm } from "@tanstack/react-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { FormInput } from "@/components/form";
import { Button } from "@/components/ui/button";
import { router } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signIn } from "@/lib/auth-client";
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
        console.log("[Login] Attempting login for:", value.email);
        const { data, error } = await signIn.email({
          email: value.email,
          password: value.password,
        });

        console.log(
          "[Login] Response - data:",
          JSON.stringify(data),
          "error:",
          JSON.stringify(error),
        );

        if (error) {
          throw new Error(error.message || "Login failed");
        }

        if (data?.user) {
          console.log("[Login] Success, navigating to home...");
          // Set user in auth store
          setUser({
            id: data.user.id,
            email: data.user.email,
            username:
              (data.user as any).username || data.user.email.split("@")[0],
            name: data.user.name || (data.user as any).firstName || "",
            avatar: data.user.image || "",
            bio: (data.user as any).bio || "",
            website: "",
            location: (data.user as any).location || "",
            hashtags: [],
            isVerified: (data.user as any).verified || false,
            postsCount: (data.user as any).postsCount || 0,
            followersCount: (data.user as any).followersCount || 0,
            followingCount: (data.user as any).followingCount || 0,
          });
          // Small delay to let auth state sync before navigation
          setTimeout(() => {
            router.replace("/(protected)/(tabs)" as any);
          }, 100);
        } else {
          toast.error("Login Failed", {
            description: "Could not load user profile",
          });
        }
      } catch (error: any) {
        console.error("[Login] Error:", error);

        // Network error - auth server not available
        if (
          error?.message?.includes("fetch") ||
          error?.message?.includes("network")
        ) {
          toast.error("Connection Error", {
            description:
              "Unable to connect to auth server. Please try again later.",
          });
        } else {
          toast.error("Login Failed", {
            description:
              error?.message || "Something went wrong. Please try again.",
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

            <View className="items-end">
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password" as any)}
              >
                <Text className="text-primary text-sm">Forgot password?</Text>
              </Pressable>
            </View>

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
