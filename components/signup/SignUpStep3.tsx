import { View, Text, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Button, Checkbox } from "@/components/ui";
import { useSignupStore } from "@/lib/stores/signup-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { FileText } from "lucide-react-native";

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

    const generatedUsername =
      `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`.replace(
        /[^a-z0-9.]/g,
        "",
      );

    const userId = `user_${Date.now()}`;

    // Record terms acceptance in Payload
    await recordTermsAcceptance(userId, formData.email);

    setUser({
      id: userId,
      email: formData.email,
      username: generatedUsername,
      name: `${formData.firstName} ${formData.lastName}`,
      isVerified: true,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    });
    resetSignup();

    router.replace("/(protected)/(tabs)" as any);
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
              <Text className="text-muted text-sm leading-relaxed">
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
          <Text className="text-sm text-muted">
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
          className={`flex-1 text-sm leading-relaxed ${!hasScrolledToBottom ? "text-muted" : "text-foreground"}`}
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
