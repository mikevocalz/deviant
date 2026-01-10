import { SymbolView, type SymbolViewProps } from "expo-symbols"
import type { IconProps } from "./types"

function Icon({
  name,
  sfSymbol,
  materialCommunityIcon: _materialCommunityIcon,
  materialIcon: _materialIcon,
  size = 24,
  ...props
}: IconProps) {
  const symbolName = (name ?? sfSymbol) as SymbolViewProps["name"]
  return <SymbolView name={symbolName} size={size} {...props} />
}

export { Icon }
