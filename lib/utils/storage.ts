import { Platform } from "react-native"
import type { StateStorage } from "zustand/middleware"
import { createMMKV } from "react-native-mmkv"

const mmkv = createMMKV({ id: "dvnt-storage" })

export const storage: StateStorage = {
  getItem: (name: string): string | null => {
    if (Platform.OS === "web") {
      return localStorage.getItem(name)
    }
    return mmkv.getString(name) ?? null
  },
  setItem: (name: string, value: string): void => {
    if (Platform.OS === "web") {
      localStorage.setItem(name, value)
    } else {
      mmkv.set(name, value)
    }
  },
  removeItem: (name: string): void => {
    if (Platform.OS === "web") {
      localStorage.removeItem(name)
    } else {
      mmkv.remove(name)
    }
  },
}
