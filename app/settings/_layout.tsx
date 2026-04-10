import { Stack } from "expo-router";
import { SettingsCloseButton } from "@/components/settings-back-button";

export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: "minimal",
        headerLeft: () => null,
        headerRight: () => <SettingsCloseButton />,
        headerTintColor: "#fff",
        headerStyle: { backgroundColor: "#000" },
        headerTitleStyle: {
          color: "#fff",
          fontFamily: "Inter-SemiBold",
          fontSize: 17,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#000" },
      }}
    />
  );
}
