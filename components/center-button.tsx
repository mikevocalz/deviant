import { Platform, Pressable, View, ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type CenterButtonProps = {
  Icon: LucideIcon;
  onPress?: () => void;
};

export function CenterButton({ Icon, onPress }: CenterButtonProps) {
  // When used as tabBarButton, position relative to tab bar container
  // Use negative bottom to push button UP above the tab bar
  const containerStyle: ViewStyle = {
    position: "absolute",
    bottom: Platform.OS === "android" ? -44 : -48, // NEGATIVE = above tabbar when used as tabBarButton (raised 14px)
    left: "50%",
    transform: [{ translateX: -30 }], // Center horizontally (half of 60px width)
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  return (
    <View style={containerStyle} pointerEvents="box-none">
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
