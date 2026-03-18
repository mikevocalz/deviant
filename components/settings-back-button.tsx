import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";

export function SettingsBackButton() {
  const router = useRouter();
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={{ marginLeft: 4, padding: 8 }}
    >
      <ChevronLeft size={24} color={colors.foreground} />
    </Pressable>
  );
}
