/**
 * User Hook
 * 
 * Provides React Query hook for fetching user data by username
 */

import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";

// Get JWT token from storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dvnt_auth_token");
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync("dvnt_auth_token");
  } catch {
    return null;
  }
}

export function useUser(username: string | null | undefined) {
  return useQuery({
    queryKey: ["users", "username", username],
    queryFn: async () => {
      if (!username) return null;
      
      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!apiUrl) return null;

        const token = await getAuthToken();

        // Use custom profile endpoint (returns JSON)
        const response = await fetch(
          `${apiUrl}/api/users/${username}/profile`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          console.error("[useUser] Profile fetch failed:", response.status);
          return null;
        }

        return await response.json();
      } catch (error) {
        console.error("[useUser] Error:", error);
        return null;
      }
    },
    enabled: !!username,
  });
}
