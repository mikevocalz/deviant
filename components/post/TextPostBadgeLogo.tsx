import { memo } from "react";
import { Asset } from "expo-asset";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SvgCssUri } from "react-native-svg/css";

const TEXT_POST_BADGE_LOGO = Asset.fromModule(
  require("../../assets/images/DVNT-logo-grad-white.svg"),
);
const TEXT_POST_BADGE_URI =
  TEXT_POST_BADGE_LOGO.localUri || TEXT_POST_BADGE_LOGO.uri || null;

// Crop the square source asset to the actual DVNT mark so it keeps the same
// short, wide footprint as the original "Text Post" label chip.
const TEXT_POST_BADGE_VIEWBOX = "52 92 138 54";

interface TextPostBadgeLogoProps {
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}

function TextPostBadgeLogoComponent({
  width,
  height,
  style,
}: TextPostBadgeLogoProps) {
  if (!TEXT_POST_BADGE_URI) return null;

  return (
    <View
      style={[
        {
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <SvgCssUri
        uri={TEXT_POST_BADGE_URI}
        width="100%"
        height="100%"
        viewBox={TEXT_POST_BADGE_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
      />
    </View>
  );
}

export const TextPostBadgeLogo = memo(TextPostBadgeLogoComponent);
