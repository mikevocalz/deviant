import { View, Pressable, Text, Platform } from "react-native";
import { Link, usePathname } from "expo-router";
import { Search, MessageSquare } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import Logo from "@/components/logo";
import { useUnreadMessageCount } from "@/lib/hooks/use-messages";
import { useFeedScrollStore } from "@/lib/stores/feed-scroll-store";

export function TabHeaderLogo() {
  const pathname = usePathname();
  const triggerScrollToTop = useFeedScrollStore((s) => s.triggerScrollToTop);
  const isHome = pathname === "/" || pathname === "/(protected)/(tabs)";
  return (
    <Pressable
      onPress={() => {
        if (isHome) triggerScrollToTop();
      }}
      hitSlop={12}
    >
      <Logo width={100} height={36} />
    </Pressable>
  );
}

export function TabHeaderRight() {
  const { colors } = useColorScheme();
  const { data: unreadCount = 0 } = useUnreadMessageCount();
  return (
    <View style={{ marginRight: 16, flexDirection: "row", alignItems: "center", gap: 20 }}>
      <Link href="/(protected)/search" asChild>
        <Pressable
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={{ padding: 6 }}
        >
          <Search size={24} color={colors.foreground} />
        </Pressable>
      </Link>
      <Link href="/(protected)/messages" asChild>
        <Pressable
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={{ padding: 6, position: "relative" }}
        >
          <MessageSquare size={24} color={colors.foreground} />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                right: 2,
                top: 2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: "#8A40CF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: "#fff",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Link>
    </View>
  );
}
