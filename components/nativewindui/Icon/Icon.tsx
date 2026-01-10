// eslint-disable-next-line import/no-extraneous-dependencies
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
// eslint-disable-next-line import/no-extraneous-dependencies
import MaterialIcons from "@expo/vector-icons/MaterialIcons"
import { SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS, SF_SYMBOLS_TO_MATERIAL_ICONS } from "rn-icon-mapper"
import type { IconProps } from "./types"
import { useColorScheme } from "@/lib/hooks"

function Icon({ name, materialCommunityIcon, materialIcon, sfSymbol: _sfSymbol, size = 24, ...props }: IconProps) {
  const { colors } = useColorScheme()
  const defaultColor = colors.foreground

  if (materialIcon) {
    return <MaterialIcons name={materialIcon} size={size} color={defaultColor} {...props} />
  }

  if (materialCommunityIcon) {
    return <MaterialCommunityIcons name={materialCommunityIcon} size={size} color={defaultColor} {...props} />
  }

  if (name) {
    const communityIcon = (SF_SYMBOLS_TO_MATERIAL_COMMUNITY_ICONS as Record<string, string>)[name]
    if (communityIcon) {
      return <MaterialCommunityIcons name={communityIcon as any} size={size} color={defaultColor} {...props} />
    }

    const materialIconName = (SF_SYMBOLS_TO_MATERIAL_ICONS as Record<string, string>)[name]
    if (materialIconName) {
      return <MaterialIcons name={materialIconName as any} size={size} color={defaultColor} {...props} />
    }
  }

  return null
}

export { Icon }
