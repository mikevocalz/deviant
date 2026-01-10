import type React from "react"
import type { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons"
import type { SymbolViewProps } from "expo-symbols"

export type IconProps = {
  name?: SymbolViewProps["name"]
  materialCommunityIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  materialIcon?: React.ComponentProps<typeof MaterialIcons>["name"]
  sfSymbol?: SymbolViewProps["name"]
  size?: number
  color?: string
  style?: SymbolViewProps["style"]
}
