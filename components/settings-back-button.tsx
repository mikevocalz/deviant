import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";

export function SettingsCloseButton() {
  const router = useRouter();
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={{
        marginRight: 8,
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 8,
      }}
    >
      <X size={18} color={colors.foreground} strokeWidth={2.5} />
    </Pressable>
  );
}
