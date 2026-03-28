import { View, Platform } from "react-native";
import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Plus } from "lucide-react-native";
import { CenterButton } from "@/components/center-button";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import "@/lib/perf/tab-prefetches"; // Register prefetch functions for tab navigation

export default function TabsLayout() {
  const triggerScrollToTop = useFeedScrollStore((s) => s.triggerScrollToTop);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs minimizeBehavior="onScrollDown">
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

        <NativeTabs.Trigger
          name="create"
          listeners={{
            tabPress: (e: any) => {
              e.preventDefault();
              router.push("/(protected)/(tabs)/create");
            },
          }}
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: "plus", selected: "plus" }}
            md="add"
          />
          <NativeTabs.Trigger.Label> </NativeTabs.Trigger.Label>
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

      {/* Custom CenterButton overlaid on top of the native "create" tab icon */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: Platform.OS === "ios" ? insets.bottom - 2 : 8,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <View style={{ paddingHorizontal: 26 }}>
          <CenterButton
            Icon={Plus}
            onPress={() => router.push("/(protected)/(tabs)/create")}
            accessoryPlacement="inline"
          />
        </View>
      </View>
    </View>
  );
}
