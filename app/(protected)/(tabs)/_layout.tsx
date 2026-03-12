import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Plus } from "lucide-react-native";
import { CenterButton } from "@/components/center-button";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";
import "@/lib/perf/tab-prefetches"; // Register prefetch functions for tab navigation

function CenterButtonAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const router = useRouter();

  return (
    <CenterButton
      Icon={Plus}
      onPress={() => router.push("/(protected)/(tabs)/create")}
      accessoryPlacement={placement}
    />
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const triggerScrollToTop = useFeedScrollStore((s) => s.triggerScrollToTop);

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.BottomAccessory>
        <CenterButtonAccessory />
      </NativeTabs.BottomAccessory>

      <NativeTabs.Trigger
        name="index"
        listeners={{
          tabPress: () => {
            triggerScrollToTop();
          },
        }}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar.badge.clock" }}
          md="calendar_month"
        />
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon
          sf={{ default: "heart", selected: "heart.fill" }}
          md="favorite"
        />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
