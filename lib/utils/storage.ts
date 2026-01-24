import { Platform } from "react-native"
import type { StateStorage } from "zustand/middleware"
import { createMMKV } from "react-native-mmkv"

let mmkv: ReturnType<typeof createMMKV> | null = null;

try {
  if (Platform.OS !== "web") {
    mmkv = createMMKV({ id: "dvnt-storage" });
  }
} catch (error) {
  console.error("[Storage] Failed to initialize MMKV:", error);
}

export const storage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      if (Platform.OS === "web") {
        return localStorage.getItem(name)
      }
      if (!mmkv) return null;
      return mmkv.getString(name) ?? null
    } catch (error) {
      console.error("[Storage] Error getting item:", error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(name, value)
      } else {
        if (mmkv) {
          mmkv.set(name, value)
        }
      }
    } catch (error) {
      console.error("[Storage] Error setting item:", error);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(name)
      } else {
        if (mmkv) {
          mmkv.remove(name)
        }
      }
    } catch (error) {
      console.error("[Storage] Error removing item:", error);
    }
  },
}
