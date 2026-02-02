/**
 * Search Hook
 * 
 * Provides React Query hooks for searching posts and users
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

export function useSearchPosts(query: string) {
  return useQuery({
    queryKey: ["search", "posts", query],
    queryFn: async () => {
      if (!query || query.length < 1) return { docs: [], totalDocs: 0 };

      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!apiUrl) return { docs: [], totalDocs: 0 };

        const token = await getAuthToken();

        // Use custom search endpoint (returns JSON)
        const response = await fetch(
          `${apiUrl}/api/search/posts?q=${encodeURIComponent(query)}&limit=50`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          console.error("[useSearchPosts] Search failed:", response.status);
          return { docs: [], totalDocs: 0 };
        }

        return await response.json();
      } catch (error) {
        console.error("[useSearchPosts] Error:", error);
        return { docs: [], totalDocs: 0 };
      }
    },
    enabled: !!query && query.length >= 1,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["search", "users", query],
    queryFn: async () => {
      if (!query || query.length < 1) return { docs: [], totalDocs: 0 };

      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!apiUrl) return { docs: [], totalDocs: 0 };

        const token = await getAuthToken();

        // Use custom search endpoint (returns JSON)
        const response = await fetch(
          `${apiUrl}/api/search/users?q=${encodeURIComponent(query)}&limit=20`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
          }
        );

        if (!response.ok) {
          console.error("[useSearchUsers] Search failed:", response.status);
          return { docs: [], totalDocs: 0 };
        }

        return await response.json();
      } catch (error) {
        console.error("[useSearchUsers] Error:", error);
        return { docs: [], totalDocs: 0 };
      }
    },
    enabled: !!query && query.length >= 1,
  });
}
