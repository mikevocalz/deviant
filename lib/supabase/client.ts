import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const FALLBACK_SUPABASE_URL = "https://npfjanxturvmjyevoyfo.supabase.co";

// Validate env var is a real URL — Metro can inline garbage values in OTA builds
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseUrl =
  typeof rawUrl === "string" && rawUrl.startsWith("https://")
    ? rawUrl
    : FALLBACK_SUPABASE_URL;
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmphbnh0dXJ2bWp5ZXZveWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjA0MjMsImV4cCI6MjA4Mzk5NjQyM30.v88MMGqv2db8hn8llr5aToKbKUDOHz-AxZbZYA5RLGM";
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAnonKey =
  typeof rawAnonKey === "string" && rawAnonKey.startsWith("eyJ")
    ? rawAnonKey
    : FALLBACK_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error(
    "[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is missing! Set it in .env",
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
