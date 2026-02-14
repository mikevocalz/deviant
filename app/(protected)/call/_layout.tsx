import { Stack, useRouter } from "expo-router";
import { FishjamProvider } from "@fishjam-cloud/react-native-client";
import Constants from "expo-constants";
import { ErrorBoundary } from "@/components/error-boundary";
import { useVideoRoomStore } from "@/src/video/stores/video-room-store";

const FISHJAM_APP_ID =
  Constants.expoConfig?.extra?.fishjamAppId ??
  process.env.EXPO_PUBLIC_FISHJAM_APP_ID ??
  "";

if (__DEV__) {
  console.log("[CallLayout] FISHJAM_APP_ID:", FISHJAM_APP_ID || "EMPTY!");
}

export default function CallLayout() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="Call"
      onGoBack={() => {
        // Reset call state on error dismiss so next call starts clean
        useVideoRoomStore.getState().reset();
        router.back();
      }}
      onGoHome={() => {
        useVideoRoomStore.getState().reset();
        router.replace("/(protected)/(tabs)");
      }}
    >
      <FishjamProvider fishjamId={FISHJAM_APP_ID} debug={__DEV__}>
        <Stack screenOptions={{ headerShown: false }} />
      </FishjamProvider>
    </ErrorBoundary>
  );
}
