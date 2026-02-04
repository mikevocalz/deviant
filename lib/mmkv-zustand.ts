/**
 * MMKV Storage adapter for Zustand persist middleware
 * Uses AsyncStorage as fallback since MMKV requires native module setup
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, PersistStorage } from "zustand/middleware";

// Create a proper Zustand-compatible storage using createJSONStorage
export const mmkvStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.error("[mmkvStorage] getItem error:", error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.error("[mmkvStorage] setItem error:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error("[mmkvStorage] removeItem error:", error);
    }
  },
}));
