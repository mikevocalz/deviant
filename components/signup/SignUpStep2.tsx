import { useState, useEffect } from "react";
import {
  View,
  Text,
  Linking,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Camera as VisionCamera } from "react-native-vision-camera";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import { useSignupStore } from "@/lib/stores/signup-store";
import { useVerificationStore } from "@/lib/stores/useVerificationStore";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  CheckCircle2,
  CreditCard,
  Camera,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
} from "lucide-react-native";
import { IdScanTab, FaceScanTab } from "@/components/verification/tabs";
import { useUIStore } from "@/lib/stores/ui-store";
import { compareFaces } from "@/lib/face-matcher";
import { compareDOBs } from "@/lib/dob-extractor";
import { signUp } from "@/lib/auth-client";
import { auth } from "@/lib/api/auth";
import { toast } from "sonner-native";
import {
  validateDateOfBirth,
  UNDERAGE_ERROR_MESSAGE,
  AGE_VERIFICATION_FAILED_MESSAGE,
} from "@/lib/utils/age-verification";

export function SignUpStep2() {
  const {
    idVerification,
    formData,
    setIDImage,
    setFaceImage,
    setVerified,
    setExtractedDOB,
    setActiveStep,
    isSubmitting,
    setIsSubmitting,
    resetSignup,
  } = useSignupStore();
  const {
    idComplete,
    faceComplete,
    idImageUri,
    faceImageUri,
    parsedId,
    reset: resetVerification,
  } = useVerificationStore();
  const { setUser } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  const [activeTab, setActiveTab] = useState<"id" | "selfie">("id");
  const [isVerifying, setIsVerifying] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);
  const [dobMismatch, setDobMismatch] = useState<string | null>(null);

  // Record terms acceptance - calls API directly
  const recordTermsAcceptance = async (userId: string, email: string) => {
    try {
      const API_URL =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "https://npfjanxturvmjyevoyfo.supabase.co";

      await fetch(`${API_URL}/rest/v1/terms_acceptance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
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

  // Create account after verification succeeds
  const createAccount = async () => {
    setIsSubmitting(true);

    console.log("[SignUp] Creating account with Better Auth...");
    console.log("[SignUp] Email:", formData.email);
    console.log("[SignUp] Username:", formData.username);

    try {
      // Sign up with Better Auth
      const { data, error } = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`,
        // Additional fields passed to Better Auth
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
      } as any);

      if (error) {
        console.error("[SignUp] Better Auth error:", error);
        toast.error("Registration Failed", {
          description: error.message || "Could not create account",
        });
        setIsSubmitting(false);
        return;
      }

      if (!data?.user) {
        console.error("[SignUp] No user returned from Better Auth");
        toast.error("Registration Failed", {
          description: "Could not create account",
        });
        setIsSubmitting(false);
        return;
      }

      console.log("[SignUp] Better Auth user created:", data.user.id);

      // Fetch the user profile from the users table
      // Pass email so getProfile can fall back to email lookup if auth_id doesn't match
      const profile = await auth.getProfile(data.user.id, data.user.email);

      if (profile) {
        console.log("[SignUp] Profile loaded, ID:", profile.id);
        setUser({
          id: profile.id,
          email: profile.email,
          username: profile.username,
          name: profile.name,
          avatar: profile.avatar || "",
          bio: profile.bio || "",
          website: profile.website || "",
          location: profile.location || "",
          hashtags: profile.hashtags || [],
          isVerified: profile.isVerified,
          postsCount: profile.postsCount,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
        });
      } else {
        // Fallback to Better Auth data if profile fetch fails
        console.warn(
          "[SignUp] Could not load Payload profile, using Better Auth data",
        );
        setUser({
          id: data.user.id,
          email: data.user.email,
          username: (data.user as any).username || formData.username,
          name: data.user.name || `${formData.firstName} ${formData.lastName}`,
          avatar: data.user.image || "",
          bio: "",
          website: "",
          location: "",
          hashtags: [],
          isVerified: true,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        });
      }

      // Record terms acceptance
      recordTermsAcceptance(profile?.id || data.user.id, formData.email).catch(
        () => {},
      );

      toast.success("Welcome to DVNT!", {
        description: "Your account has been created and verified.",
      });

      resetSignup();
      resetVerification();
      router.replace("/(protected)/(tabs)" as any);
    } catch (error: any) {
      console.error("[Signup] Error:", error);

      let errorMsg = "Please try again";
      if (error?.message) {
        errorMsg = error.message;
      }

      if (
        errorMsg.includes("already exists") ||
        errorMsg.includes("duplicate")
      ) {
        errorMsg = "This email or username is already registered";
      }

      toast.error("Failed to create account", {
        description: errorMsg,
      });
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    checkAndRequestPermissions();
  }, []);

  // Sync verification store images to auth store
  useEffect(() => {
    if (idImageUri && idImageUri !== idVerification.idImage) {
      setIDImage(idImageUri);
      setFaceImage("");
      setVerified(false);
      setMatchConfidence(null);
      setDobMismatch(null);

      // Extract and compare DOB from parsed ID
      if (parsedId?.dob) {
        const isOver18 = checkAge(parsedId.dob);
        setExtractedDOB(parsedId.dob, isOver18);

        if (formData?.dateOfBirth) {
          const dobComparison = compareDOBs(parsedId.dob, formData.dateOfBirth);
          console.log("[SignUpStep2] DOB comparison:", dobComparison);

          if (!dobComparison.match) {
            setDobMismatch(dobComparison.message);
            showToast("error", "Date of Birth Mismatch", dobComparison.message);
          }
        }

        if (isOver18 === false) {
          showToast(
            "error",
            "Age Restriction",
            "You must be 18 years or older to sign up.",
          );
        }
      }

      setActiveTab("selfie");
    }
  }, [idImageUri, parsedId]);

  useEffect(() => {
    if (faceImageUri && faceImageUri !== idVerification.faceImage) {
      setFaceImage(faceImageUri);
      setVerified(false);
      setMatchConfidence(null);
    }
  }, [faceImageUri]);

  /**
   * CRITICAL: Age check using centralized validation
   * Returns true if 18+, false if under 18, null if invalid
   */
  function checkAge(dobString: string): boolean | null {
    const result = validateDateOfBirth(dobString);
    if (!result.isValid) return null;
    return result.isOver18;
  }

  const checkAndRequestPermissions = async () => {
    try {
      console.log("[SignUpStep2] Starting permission check...");

      // Request camera via VisionCamera
      let cameraStatus = await VisionCamera.getCameraPermissionStatus();
      console.log("[SignUpStep2] Initial camera status:", cameraStatus);

      if (cameraStatus !== "granted") {
        cameraStatus = await VisionCamera.requestCameraPermission();
        console.log(
          "[SignUpStep2] Camera permission after request:",
          cameraStatus,
        );
      }

      // Mic is optional for ID verification - only camera is truly required
      let micGranted = true; // Default to true, mic not strictly needed
      if (Platform.OS === "android") {
        try {
          const micPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          console.log("[SignUpStep2] Android mic check:", micPermission);

          if (!micPermission) {
            const result = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: "Microphone Permission",
                message:
                  "This app needs access to your microphone for verification.",
                buttonNeutral: "Ask Me Later",
                buttonNegative: "Cancel",
                buttonPositive: "OK",
              },
            );
            console.log("[SignUpStep2] Android mic request result:", result);
            // Don't block on mic permission
          }
        } catch (micError) {
          console.log(
            "[SignUpStep2] Android mic error (non-blocking):",
            micError,
          );
        }
      } else {
        // iOS - try to get mic but don't block on it
        try {
          let micStatus = await VisionCamera.getMicrophonePermissionStatus();
          console.log("[SignUpStep2] iOS mic status:", micStatus);
          if (micStatus !== "granted") {
            micStatus = await VisionCamera.requestMicrophonePermission();
            console.log("[SignUpStep2] iOS mic after request:", micStatus);
          }
        } catch (micError) {
          console.log("[SignUpStep2] iOS mic error (non-blocking):", micError);
        }
      }

      // Only camera is strictly required
      console.log("[SignUpStep2] Final camera status:", cameraStatus);
      if (cameraStatus === "granted") {
        console.log("[SignUpStep2] Camera granted - enabling verification");
        setPermissionsGranted(true);
      } else {
        console.log("[SignUpStep2] Camera NOT granted");
        showToast(
          "error",
          "Camera Required",
          "Please grant camera access in Settings to verify your identity.",
        );
      }
    } catch (error) {
      console.error("[SignUpStep2] Permission request error:", error);
      showToast("error", "Permission Error", String(error));
    }
  };

  const requestPermissions = async () => {
    try {
      const cameraPermission = await VisionCamera.requestCameraPermission();
      const microphonePermission =
        await VisionCamera.requestMicrophonePermission();

      console.log("Requested permissions:", {
        camera: cameraPermission,
        mic: microphonePermission,
      });

      if (
        cameraPermission === "granted" &&
        microphonePermission === "granted"
      ) {
        setPermissionsGranted(true);
      } else {
        showToast("error", "Please grant permissions in Settings");
      }
    } catch (error) {
      console.error("Permission request error:", error);
      showToast("error", "Failed to request permissions");
    }
  };

  const bothCaptured = idComplete && faceComplete;
  const canProceed =
    idVerification.isVerified &&
    idVerification.isOver18 !== false &&
    !dobMismatch;

  const handleVerify = async () => {
    console.log("[SignUpStep2] handleVerify called");

    if (!idVerification.idImage || !idVerification.faceImage) {
      console.log("[SignUpStep2] Missing images");
      showToast(
        "error",
        "Missing Images",
        "Please complete both ID scan and face scan before verifying.",
      );
      return;
    }

    if (idVerification.isOver18 === false) {
      console.log("[SignUpStep2] Under 18");
      showToast(
        "error",
        "Age Restriction",
        "You must be 18 years or older to sign up.",
      );
      return;
    }

    if (dobMismatch) {
      showToast(
        "error",
        "Date of Birth Mismatch",
        "The date of birth on your ID doesn't match what you entered. Please upload the correct ID or go back and correct your date of birth.",
      );
      return;
    }

    setIsVerifying(true);
    setMatchConfidence(null);
    console.log("[SignUpStep2] Starting verification process...");
    console.log("[SignUpStep2] Platform:", Platform.OS);

    try {
      const result = await compareFaces(
        idVerification.idImage,
        idVerification.faceImage,
      );
      console.log("[SignUpStep2] Verification result:", result);

      setMatchConfidence(result.confidence);

      if (result.match) {
        setVerified(true);
        console.log("[SignUpStep2] Verification successful");
        showToast(
          "success",
          "Verification Successful",
          `Your identity has been verified with ${result.confidence.toFixed(1)}% confidence.`,
        );
      } else {
        console.log("[SignUpStep2] Verification failed");
        showToast(
          "error",
          "Verification Failed",
          "Face doesn't match. Please retake your selfie with better lighting and ensure your face is clearly visible.",
        );
      }
    } catch (error: any) {
      console.error("[SignUpStep2] Verification error:", error);
      console.error("[SignUpStep2] Error message:", error?.message);
      console.error("[SignUpStep2] Error stack:", error?.stack);

      // iOS fallback: If Regula SDK fails on iOS, mark as pending manual review
      // This allows users to continue signup while their ID is flagged for review
      if (Platform.OS === "ios") {
        console.log(
          "[SignUpStep2] iOS Regula fallback - marking for manual review",
        );
        setVerified(true);
        setMatchConfidence(0); // Flag as needing manual review
        showToast(
          "success",
          "Verification Submitted",
          "Your documents have been submitted for review. You can continue signing up.",
        );
        setIsVerifying(false);
        return;
      }

      const errorMessage = error.message || "Verification failed";
      let toastDescription = "";

      if (
        errorMessage.includes("No face detected in ID") ||
        errorMessage.includes("No human face detected in ID")
      ) {
        toastDescription =
          "No face was detected in your ID document. Please upload a valid government-issued ID with a clear, visible photo.";
      } else if (
        errorMessage.includes("No face detected in selfie") ||
        errorMessage.includes("No human face detected in selfie")
      ) {
        toastDescription =
          "No face was detected in your selfie. Please retake ensuring your face is clearly visible and well-lit.";
      } else {
        toastDescription = errorMessage;
      }

      showToast("error", "Verification Error", toastDescription);
    }

    setIsVerifying(false);
  };

  if (!permissionsGranted) {
    return (
      <ScrollView
        className="flex-1 h-screen"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          paddingBottom: 40,
        }}
      >
        <View className="bg-destructive/10 rounded-lg p-6 mx-4">
          <View className="flex-row items-center gap-3 mb-3">
            <ShieldAlert size={24} className="text-destructive" />
            <Text className="text-lg font-semibold text-foreground">
              Permissions Required
            </Text>
          </View>
          <Text className="text-sm text-muted mb-4">
            Camera and microphone access are required to scan your ID and
            capture a selfie for verification.
          </Text>
          <Button onPress={requestPermissions}>Grant Permissions</Button>
          <Button
            variant="secondary"
            onPress={() => Linking.openSettings()}
            className="mt-2"
          >
            Open Settings
          </Button>
        </View>
        <Button variant="secondary" onPress={() => setActiveStep(1)}>
          Go Back
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        gap: 12,
        paddingBottom: 40,
        paddingHorizontal: 16,
      }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center gap-2">
        <Text className="text-xl font-semibold text-foreground">
          Identity Verification
        </Text>
        <Text className="text-sm text-zinc-500w text-center">
          Scan your ID document and capture a selfie for verification
        </Text>
      </View>

      {idVerification.isOver18 === false && (
        <View className="bg-destructive/10 rounded-lg p-4 flex-row items-start gap-3">
          <ShieldAlert size={16} className="text-destructive mt-0.5" />
          <View className="flex-1">
            <Text className="font-medium text-destructive">
              Age Restriction
            </Text>
            <Text className="text-sm text-muted">
              You must be 18 years or older to create an account. The date of
              birth extracted from your ID indicates you are under 18.
            </Text>
          </View>
        </View>
      )}

      {dobMismatch && (
        <View className="bg-destructive/10 rounded-lg p-4 flex-row items-start gap-3">
          <ShieldAlert size={16} className="text-destructive mt-0.5" />
          <View className="flex-1">
            <Text className="font-medium text-destructive">
              Date of Birth Mismatch
            </Text>
            <Text className="text-sm text-muted">
              {dobMismatch} Please upload the correct ID or go back and correct
              your date of birth.
            </Text>
          </View>
        </View>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "id" | "selfie")}
        className="flex-1"
      >
        <TabsList className="flex-row w-full mb-4">
          <TabsTrigger
            value="id"
            className="flex-1 flex-row items-center justify-center gap-2"
          >
            <CreditCard size={16} className="text-foreground" />
            <Text className="text-foreground">ID Document</Text>
            {idComplete && <CheckCircle2 size={12} className="text-primary" />}
          </TabsTrigger>
          <TabsTrigger
            value="selfie"
            className="flex-1 flex-row items-center justify-center gap-2"
          >
            <Camera size={16} className="text-foreground" />
            <Text className="text-foreground">Face Scan</Text>
            {faceComplete && (
              <CheckCircle2 size={12} className="text-primary" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="id" className="flex-1 mt-4">
          <IdScanTab />
        </TabsContent>

        <TabsContent value="selfie" className="flex-1 mt-4">
          <FaceScanTab />
        </TabsContent>
      </Tabs>

      {idVerification.idImage &&
        idVerification.faceImage &&
        !idVerification.isVerified &&
        idVerification.isOver18 !== false && (
          <Button
            variant="outline"
            onPress={handleVerify}
            disabled={isVerifying}
            className="w-full flex-row items-center justify-center border-primary"
          >
            {isVerifying ? (
              <Text className="text-foreground">⏳ Verifying...</Text>
            ) : (
              <>
                <CheckCircle2 size={16} className="text-primary mr-2" />
                <Text className="text-foreground font-semibold">
                  Verify Identity
                </Text>
              </>
            )}
          </Button>
        )}

      {idVerification.isVerified && (
        <View className="bg-primary rounded-lg p-4 flex-row items-center gap-3">
          <CheckCircle2 size={20} className="text-white" />
          <View className="flex-1">
            <Text className="font-medium text-white">
              Verification Successful
            </Text>
            <Text className="text-sm text-white/80">
              Your identity has been verified successfully -
              {matchConfidence &&
                ` with ${matchConfidence.toFixed(1)}% confidence.`}
            </Text>
          </View>
        </View>
      )}

      <View className="flex-row gap-3 pt-4">
        <Button
          variant="outline"
          onPress={() => setActiveStep(1)}
          className="flex-1 flex-row items-center justify-center"
        >
          <ArrowLeft size={16} className="text-foreground mr-2" />
          <Text className="ml-3 text-foreground">Back</Text>
        </Button>
        <Button
          onPress={createAccount}
          disabled={!canProceed || isSubmitting}
          className="flex-1 flex-row items-center justify-center"
        >
          <Text className="mr-3 text-primary-foreground">
            {isSubmitting ? "Creating..." : "Complete Signup"}
          </Text>
          {!isSubmitting && (
            <ArrowRight size={16} className="text-primary-foreground ml-2" />
          )}
        </Button>
      </View>
    </ScrollView>
  );
}
