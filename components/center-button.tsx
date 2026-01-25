import { Platform, Pressable, View, ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type CenterButtonProps = {
  Icon: LucideIcon;
  onPress?: () => void;
};

export function CenterButton({ Icon, onPress }: CenterButtonProps) {
  // The button is rendered inside the tab bar item slot (height ~60)
  // Use top positioning to push the button above the tab bar
  // Negative top = above the slot, positive top = inside/below
  const containerStyle: ViewStyle = {
    position: "absolute",
    top: Platform.OS === "android" ? -20 : -24, // Push up above tab bar
    left: "50%",
    transform: [{ translateX: -30 }],
    width: 60,
    height: 60,
    zIndex: 999,
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
