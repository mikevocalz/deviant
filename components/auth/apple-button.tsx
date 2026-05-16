/**
 * Sign in with Apple — native iOS flow.
 *
 * App Store Guideline 4.8 requires SIWA on apps that offer any third-party
 * auth. We use the native `expo-apple-authentication` SDK (not Better Auth's
 * web OAuth redirect) because the redirect path bounces through Safari and
 * does not return a usable session on a real device.
 *
 * Flow:
 *   1. AppleAuthentication.signInAsync() → Apple sheet → identityToken (JWT)
 *   2. Send the identityToken to Better Auth via signIn.social({ idToken })
 *      — BA validates the JWT against Apple's JWKs, creates/links the user,
 *      and persists the session via the expoClient SecureStore adapter.
 *   3. Apple returns the user's full name ONLY on first sign-in. If present,
 *      we forward it to updateProfile so the BA user.name is populated.
 *   4. syncAuthUser() mirrors the BA user row into our public.users table.
 *
 * Apple HIG: the button MUST use Apple's official component on iOS for
 * localization, dynamic type, and visual treatment.
 */
import { useState } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { signIn } from "@/lib/auth-client";
import { syncAuthUser, updateProfile } from "@/lib/api/privileged";
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
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token");
      }

      // Better Auth native social flow — validates the identity token JWT
      // against Apple JWKs and establishes a session in SecureStore.
      const result = await signIn.social({
        provider: "apple",
        idToken: { token: credential.identityToken },
      } as Parameters<typeof signIn.social>[0]);

      if (result.error) {
        throw new Error(result.error.message || "Apple sign in failed");
      }

      // Apple only returns the user's full name on the first sign-in.
      // Capture it here and persist it before falling through to sync.
      const givenName = credential.fullName?.givenName?.trim() ?? "";
      const familyName = credential.fullName?.familyName?.trim() ?? "";
      const displayName = [givenName, familyName].filter(Boolean).join(" ");
      if (displayName) {
        try {
          await updateProfile({
            name: displayName,
            firstName: givenName || undefined,
            lastName: familyName || undefined,
          } as Parameters<typeof updateProfile>[0]);
        } catch (nameErr) {
          // Non-fatal: BA user exists, just missing the name field.
          console.warn(
            "[AppleButton] First-signin name persist failed:",
            nameErr,
          );
        }
      }

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
      // User tapped Cancel in the Apple sheet — silent, not an error.
      if (error?.code === "ERR_REQUEST_CANCELED") return;
      console.error("[AppleButton] Sign in error:", error);
      onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ height: 52, width: "100%" }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={12}
        style={{ flex: 1, width: "100%" }}
        onPress={handleAppleSignIn}
      />
      {isLoading ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.6)",
            borderRadius: 12,
          }}
          pointerEvents="auto"
        >
          <ActivityIndicator size="small" color="#000" />
        </View>
      ) : null}
    </View>
  );
}
