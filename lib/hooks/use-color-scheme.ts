import { useColorScheme as useNativewindColorScheme } from "nativewind"
import { COLORS } from "@/theme/colors"

function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativewindColorScheme()

  function toggleColorScheme() {
    return setColorScheme(colorScheme === "light" ? "dark" : "light")
  }

  return {
    colorScheme: colorScheme ?? "dark",
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
    toggleColorScheme,
    colors: COLORS[colorScheme ?? "dark"],
  }
}

export { useColorScheme }
