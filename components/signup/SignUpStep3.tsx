import { View, Text, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Button, Checkbox } from "@/components/ui";
import { useSignupStore } from "@/lib/stores/signup-store";
import { FileText } from "lucide-react-native";

/**
 * SignUpStep3 - Terms Agreement
 * 
 * This is STEP 3 in the signup flow (displayed at activeStep index 1):
 * - Step 1 (index 0): User Info (SignUpStep1)
 * - Step 2 (index 1): Terms (SignUpStep3) ← WE ARE HERE
 * - Step 3 (index 2): Verification (SignUpStep2)
 * 
 * User reads and accepts terms before proceeding to verification.
 * Account creation happens AFTER verification in SignUpStep2.
 */
export function SignUpStep3() {
  const {
    hasScrolledToBottom,
    termsAccepted,
    setActiveStep,
    setHasScrolledToBottom,
    setTermsAccepted,
  } = useSignupStore();

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleContinue = () => {
    if (!termsAccepted || !hasScrolledToBottom) return;
    // Go to Step 3: Verification (activeStep index 2)
    setActiveStep(2);
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
          Please read and accept our policies to continue
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
          onPress={() => setActiveStep(0)} // Back to Step 1: User Info
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onPress={handleContinue}
          disabled={!termsAccepted || !hasScrolledToBottom}
          className="flex-1"
        >
          Continue to Verification
        </Button>
      </View>
    </View>
  );
}
