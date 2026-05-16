/**
 * Sign in with Apple Button
 *
 * App Store Requirement: Apps using third-party login must offer Sign in with Apple
 */

import { useState } from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { signIn } from "@/lib/auth-client";
import { syncAuthUser } from "@/lib/api/privileged";
import type { AppUser } from "@/lib/auth-client";

interface AppleButtonProps {
  onSuccess: (user: AppUser) => void;
  onError: (error: Error) => void;
}

export function AppleButton({ onSuccess, onError }: AppleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signIn.social({
        provider: "apple",
      });

      if (result.error) {
        throw new Error(result.error.message || "Apple sign in failed");
      }

      // Handle redirect flow (Apple uses OAuth redirect)
      if (result.data?.redirect) {
        // This shouldn't happen on mobile - should get direct token
        throw new Error("Unexpected redirect from Apple sign in");
      }

      const userData = (result.data as any)?.user;
      if (!userData) {
        throw new Error("No user returned from Apple sign in");
      }

      // Sync user to app's users table
      const profile = await syncAuthUser();

      if (!profile) {
        throw new Error("Failed to sync user profile");
      }

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
      className="flex-row items-center justify-center gap-2 rounded-xl bg-white py-4 active:opacity-90"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <>
          {/* Apple logo - Unicode approximation */}
          <Text className="text-xl text-black"></Text>
          <Text className="font-semibold text-black">Sign in with Apple</Text>
        </>
      )}
    </Pressable>
  );
}
