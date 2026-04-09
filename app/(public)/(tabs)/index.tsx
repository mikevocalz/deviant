import { View } from "react-native";
import { Main } from "@expo/html-elements";
import { ErrorBoundary } from "@/components/error-boundary";
import { PublicBrowseBanner } from "@/components/access/PublicBrowseBanner";
import { Feed } from "@/components/feed/feed";
import { usePublicGateStore } from "@/lib/stores/public-gate-store";

export default function PublicHomeScreen() {
  const openGate = usePublicGateStore((s) => s.openGate);

  return (
    <View className="flex-1 bg-background max-w-3xl w-full self-center">
      <Main className="flex-1">
        <ErrorBoundary screenName="PublicFeed">
          <Feed
            guestMode
            onGuestGate={openGate}
            headerContent={<PublicBrowseBanner variant="feed" />}
          />
        </ErrorBoundary>
      </Main>
    </View>
  );
}
