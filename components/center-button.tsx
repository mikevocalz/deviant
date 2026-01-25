import { Platform, Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type CenterButtonProps = {
  Icon: LucideIcon;
  onPress?: () => void;
};

export function CenterButton({ Icon, onPress }: CenterButtonProps) {
  // Position the button to sit visually above the tab bar
  // Use marginTop with negative value to pull it up from the tab slot
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        marginTop: Platform.OS === "android" ? -30 : -28,
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          width: 60,
          height: 60,
          borderRadius: 12,
          backgroundColor: "#fafafa",
          alignItems: "center",
          justifyContent: "center",
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Icon size={28} color="#000" strokeWidth={3} />
      </Pressable>
    </View>
  );
}
