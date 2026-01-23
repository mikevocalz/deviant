import { View, Text, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Button, Checkbox } from "@/components/ui";
import { useSignupStore } from "@/lib/stores/signup-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { FileText } from "lucide-react-native";
import { toast } from "sonner-native";
import { signUp } from "@/lib/auth-client";

export function SignUpStep3() {
  const {
    formData,
    hasScrolledToBottom,
    termsAccepted,
    isSubmitting,
    setActiveStep,
    setHasScrolledToBottom,
    setTermsAccepted,
    setIsSubmitting,
    resetSignup,
  } = useSignupStore();
  const { setUser } = useAuthStore();

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const recordTermsAcceptance = async (userId: string, email: string) => {
    try {
      await fetch("/api/terms-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          acceptedAt: new Date().toISOString(),
          termsVersion: "1.0",
          acceptedPolicies: [
            "terms-of-service",
            "privacy-policy",
            "community-standards",
            "verification-requirements",
          ],
        }),
      });
    } catch (error) {
      console.error("[Signup] Failed to record terms acceptance:", error);
    }
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !hasScrolledToBottom) return;

    setIsSubmitting(true);

    console.log("[SignUp] Form data:", {
      email: formData.email,
      password: formData.password ? "***" : "MISSING",
      name: `${formData.firstName} ${formData.lastName}`,
      username: formData.username,
    });

    try {
      // Register with Better Auth
      const result = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`,
        username: formData.username || formData.email.split("@")[0],
      });

      console.log("[SignUp] Result received:", JSON.stringify(result, null, 2));

      if (result.error) {
        toast.error("Registration Failed", {
          description: result.error.message || "Could not create account",
        });
        setIsSubmitting(false);
        return;
      }

      // Handle both result.data.user and result.user structures
      const user = result.data?.user || (result as any).user;

      if (user) {
        // Record terms acceptance
        recordTermsAcceptance(user.id, formData.email).catch(() => {});

        toast.success("Account Created!", {
          description: "Welcome to DVNT",
        });

        resetSignup();
        router.replace("/(protected)/(tabs)" as any);
      } else {
        console.error("[SignUp] No user in result:", result);
        toast.error("Registration issue", {
          description: "Account may have been created. Try signing in.",
        });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("[Signup] Error creating account:", error);
      console.error("[Signup] Error type:", typeof error);
      console.error("[Signup] Error JSON:", JSON.stringify(error, null, 2));
      console.error(
        "[Signup] Error keys:",
        error ? Object.keys(error) : "null",
      );

      // Try to extract a meaningful error message
      let errorMsg = "Please try again";
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error?.message) {
        errorMsg = error.error.message;
      } else if (error?.statusText) {
        errorMsg = error.statusText;
      } else if (typeof error === "string") {
        errorMsg = error;
      }

      console.error("[Signup] Final error message:", errorMsg);

      toast.error("Failed to create account", {
        description: errorMsg,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <View className="gap-6 flex-1">
      <View className="items-center gap-2">
        <View className="h-12 w-12 rounded-full bg-primary/10 items-center justify-center">
          <FileText size={24} className="text-primary" />
        </View>
        <Text className="text-xl font-semibold text-foreground">
          DVNT Membership Agreement
        </Text>
        <Text className="text-sm text-muted text-center">
          Please read and accept our policies to join the DVNT community
        </Text>
      </View>

      <View
        className="border border-border rounded-lg bg-card"
        style={{ height: 300 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          bounces={true}
          overScrollMode="always"
        >
          <View style={{ gap: 16 }}>
            <View>
              <Text className="font-semibold text-foreground mb-2">
                About DVNT
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                DVNT is a protected, members-only platform created for Black and
                Brown LGBTQ+ people. We are a safe, affirming, and culturally
                grounded digital home operated by Deviant LLC and Counter
                Culture Society.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                1. Eligibility (18+ Only)
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                DVNT is strictly for adults 18 years or older. All members must
                complete Photo ID + Selfie Verification to confirm age and human
                identity. DVNT does not allow bots, AI-generated profiles,
                impersonators, or fraudulent accounts.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                2. Identity Verification
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                To protect our community, you must submit a valid
                government-issued ID and a live selfie. This data is encrypted,
                never displayed publicly, never sold or shared with advertisers,
                and access is limited to authorized staff only. Your public
                profile uses your chosen name and photos.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                3. Community Standards
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                DVNT has zero tolerance for racism, anti-Blackness, transphobia,
                homophobia, harassment, bullying, doxxing, or any form of
                discrimination. Members must treat others with kindness, respect
                consent, and show consideration for fellow community members.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                4. Privacy Protection
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                DVNT does NOT sell user data, share data with advertisers, or
                run targeted ads. Your verification data is encrypted, stored
                separately from your profile, and never used for behavioral
                analysis. You control your profile visibility.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                5. Member Responsibilities
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                You agree to provide accurate information, maintain account
                security, follow Community Standards, and respect other members.
                Violations may result in content removal, suspension, or
                permanent ban.
              </Text>
            </View>

            <View>
              <Text className="font-semibold text-foreground mb-2">
                6. Terms of Service
              </Text>
              <Text className="text-zinc-400 text-sm leading-relaxed">
                By joining DVNT, you accept our Terms of Service, Privacy
                Policy, Community Standards, and Verification Requirements. DVNT
                is provided "as is" and we reserve the right to suspend or
                terminate accounts for violations.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {!hasScrolledToBottom && (
        <View className="items-center">
          <Text className="text-sm text-zinc-400">
            Please scroll to the bottom to continue
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => hasScrolledToBottom && setTermsAccepted(!termsAccepted)}
        className="flex-row items-start gap-3 p-4 rounded-lg border border-border bg-card"
      >
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(v) => hasScrolledToBottom && setTermsAccepted(v)}
        />
        <Text
          className={`flex-1 text-sm leading-relaxed ${!hasScrolledToBottom ? "text-slate-400" : "text-foreground"}`}
        >
          I confirm I am 18+ years old, and I agree to DVNT's Terms of Service,
          Privacy Policy, Community Standards, and Identity Verification
          Requirements.
        </Text>
      </Pressable>

      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          onPress={() => setActiveStep(1)}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onPress={handleSubmit}
          disabled={!termsAccepted || !hasScrolledToBottom || isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? "Creating Account..." : "Complete Sign Up"}
        </Button>
      </View>
    </View>
  );
}
