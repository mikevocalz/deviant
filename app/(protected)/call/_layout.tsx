import { Stack } from "expo-router";
import { FishjamProvider } from "@fishjam-cloud/react-native-client";

const FISHJAM_APP_ID =
  process.env.EXPO_PUBLIC_FISHJAM_APP_ID || "e921bfe88b244ced97fdd1d8d9a2c6f0";

export default function CallLayout() {
  return (
    <FishjamProvider fishjamId={FISHJAM_APP_ID}>
      <Stack screenOptions={{ headerShown: false }} />
    </FishjamProvider>
  );
}
