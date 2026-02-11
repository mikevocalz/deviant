import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://npfjanxturvmjyevoyfo.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmphbnh0dXJ2bWp5ZXZveWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjA0MjMsImV4cCI6MjA4Mzk5NjQyM30.v88MMGqv2db8hn8llr5aToKbKUDOHz-AxZbZYA5RLGM";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] Missing environment variables — using production fallbacks",
  );
}

// Custom storage adapter for expo-secure-store
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

console.log("[Supabase] Client initialized (anon only)");
