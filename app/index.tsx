import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function IndexRoute() {
  const authStatus = useAuthStore((s) => s.authStatus);
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated || authStatus === "loading") {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(public)/(tabs)" />;
}
