import { Stack } from "expo-router";
import { FishjamProvider } from "@fishjam-cloud/react-native-client";
import Constants from "expo-constants";

const FISHJAM_APP_ID =
  Constants.expoConfig?.extra?.fishjamAppId ??
  process.env.EXPO_PUBLIC_FISHJAM_APP_ID ??
  "";

export default function CallLayout() {
  return (
    <FishjamProvider fishjamId={FISHJAM_APP_ID}>
      <Stack screenOptions={{ headerShown: false }} />
    </FishjamProvider>
  );
}
