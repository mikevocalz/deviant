import { Platform, Pressable, View, ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type CenterButtonProps = {
  Icon: LucideIcon;
  onPress?: () => void;
};

export function CenterButton({ Icon, onPress }: CenterButtonProps) {
  // IMPORTANT: The button MUST be positioned ABOVE the tabbar, never below it
  // Use positive bottom values to push it up, negative values push it down
  const containerStyle: ViewStyle = {
    position: "absolute",
    bottom: Platform.OS === "android" ? 8 : 12, // Above tabbar (positive = above)
    left: "50%",
    transform: [{ translateX: -30 }],
    width: 60,
    height: 60,
  };

  return (
    <View style={containerStyle}>
      <Pressable
        onPress={onPress}
        className="h-full w-full items-center justify-center bg-zinc-50"
        style={{
          borderRadius: 12,
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
