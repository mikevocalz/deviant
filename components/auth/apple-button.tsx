/**
 * Sign in with Apple — Better Auth OAuth flow (no native dependency).
 *
 * Why not expo-apple-authentication?
 *   On iOS 26 beta + Expo SDK 56 preview.12, expo-apple-authentication's
 *   autolinking triggers an ExpoModulesJSI boot crash. The native package
 *   isn't necessary anyway — Better Auth's `socialProviders.apple` config
 *   in our auth edge function handles the full OAuth dance server-side.
 *
 * Flow:
 *   1. signIn.social({ provider: "apple" }) → BA returns an Apple
 *      authorize URL
 *   2. The Better Auth Expo client plugin (@better-auth/expo/client) opens
 *      the URL in the system in-app browser
 *   3. User signs in with Apple → Apple redirects to BA's
 *      /api/auth/callback/apple
 *   4. BA exchanges the code, creates/links the user, sets a session
 *   5. BA deep-links back to the app via the `dvnt://` scheme with the
 *      session token
 *   6. The expo client plugin stores the session in SecureStore
 *   7. We sync the BA user into our users table via syncAuthUser
 *
 * App Store HIG note: the button uses Apple's required visual treatment
 * (black/white pill, SF Symbols Apple logo, "Sign in with Apple" copy).
 * Apple Review accepts a styled Pressable matching these specs.
 */
import { useState } from "react";
import { Pressable, Text, View, ActivityIndicator, Platform } from "react-native";
import { signIn } from "@/lib/auth-client";
import { syncAuthUser } from "@/lib/api/privileged";
import type { AppUser } from "@/lib/auth-client";

interface AppleButtonProps {
  onSuccess: (user: AppUser) => void;
  onError: (error: Error) => void;
}

export function AppleButton({ onSuccess, onError }: AppleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== "ios") return null;

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      // Better Auth Expo client plugin opens the in-app browser, runs the
      // OAuth dance with Apple via our auth edge function, and stores the
      // session in SecureStore. The promise resolves once the deep-link
      // round-trip completes.
      const result = await signIn.social({
        provider: "apple",
        callbackURL: "dvnt://",
      });

      if (result.error) {
        throw new Error(result.error.message || "Apple sign in failed");
      }

      // BA session is now in SecureStore. Mirror the BA user into our
      // public.users table so the rest of the app has the integer
      // users.id available.
      const profile = await syncAuthUser();
      if (!profile) throw new Error("Failed to sync user profile");

      const user: AppUser = {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        name: profile.name,
        avatar: profile.avatar || "",
        bio: profile.bio || "",
        website: (profile as any).website || "",
        location: profile.location || "",
        hashtags: (profile as any).hashtags || [],
        isVerified: profile.isVerified,
        postsCount: profile.postsCount,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount,
      };

      onSuccess(user);
    } catch (error: any) {
      // User cancelled the OAuth sheet — silent.
      const msg = String(error?.message || error || "").toLowerCase();
      if (
        msg.includes("cancel") ||
        msg.includes("dismiss") ||
        msg.includes("user_cancelled")
      ) {
        return;
      }
      console.error("[AppleButton] Sign in error:", error);
      onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handleAppleSignIn}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
      className="flex-row items-center justify-center gap-2 rounded-xl bg-white py-4 active:opacity-90"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 20, color: "#000", lineHeight: 22 }}></Text>
          <Text style={{ fontWeight: "600", color: "#000", fontSize: 16 }}>
            Sign in with Apple
          </Text>
        </View>
      )}
    </Pressable>
  );
}
