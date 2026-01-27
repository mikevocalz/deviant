import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/utils/storage";

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  hashtags?: string[];
  isVerified: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

interface AuthStore {
  user: User | null;
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  logout: () => void;
  loadAuthState: () => Promise<void>;
}

// Track rehydration state to prevent reload during rehydration
let isRehydrating = true;
let rehydrationPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      hasSeenOnboarding: false,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
      logout: () => set({ user: null, isAuthenticated: false }),
      loadAuthState: async () => {
        // Wait for rehydration to complete first
        if (rehydrationPromise) {
          await rehydrationPromise;
        }

        // State is automatically loaded from storage by Zustand persist
        // If user is null but we have a token, try to restore from API
        const state = get();
        if (!state.user && !state.isAuthenticated) {
          try {
            const { Platform } = require("react-native");
            const SecureStore =
              Platform.OS === "web" ? null : require("expo-secure-store");

            // Use correct async methods for SecureStore vs localStorage
            let token: string | null = null;
            if (Platform.OS === "web") {
              token =
                typeof window !== "undefined"
                  ? localStorage.getItem("dvnt_auth_token")
                  : null;
            } else {
              token = await SecureStore.getItemAsync("dvnt_auth_token");
            }
            if (token) {
              console.log("[Auth] Token found, restoring user from API...");
              // Try to fetch current user from API
              const { users } = await import("@/lib/api-client");
              const result = await users.me();
              if (result?.user) {
                console.log("[Auth] User restored from API:", result.user.id);
                const userData = result.user as Record<string, any>;
                set({
                  user: {
                    id: String(userData.id),
                    email: String(userData.email || ""),
                    username: String(userData.username || ""),
                    name: String(userData.name || userData.username || ""),
                    avatar: userData.avatar
                      ? String(userData.avatar)
                      : undefined,
                    bio: userData.bio ? String(userData.bio) : undefined,
                    website: userData.website
                      ? String(userData.website)
                      : undefined,
                    location: userData.location
                      ? String(userData.location)
                      : undefined,
                    hashtags: Array.isArray(userData.hashtags)
                      ? userData.hashtags
                      : [],
                    isVerified: Boolean(userData.isVerified) || false,
                    postsCount: Number(userData.postsCount) || 0,
                    followersCount: Number(userData.followersCount) || 0,
                    followingCount: Number(userData.followingCount) || 0,
                  },
                  isAuthenticated: true,
                });
              } else {
                console.log("[Auth] Token invalid, clearing...");
                if (Platform.OS === "web") {
                  localStorage.removeItem("dvnt_auth_token");
                } else {
                  await SecureStore.deleteItemAsync("dvnt_auth_token");
                }
              }
            }
          } catch (error) {
            console.error("[Auth] Failed to restore user:", error);
            // Don't throw - app should still work
          }
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => storage),
      version: 1,
      onRehydrateStorage: () => {
        // Mark that rehydration is starting
        isRehydrating = true;
        rehydrationPromise = new Promise<void>((resolve) => {
          // This callback runs after rehydration completes
          setTimeout(() => {
            isRehydrating = false;
            resolve();
          }, 100); // Small delay to ensure all stores are rehydrated
        });

        return (state, error) => {
          if (error) {
            console.error("[Auth] Rehydration error:", error);
            isRehydrating = false;
            if (rehydrationPromise) {
              rehydrationPromise = null;
            }
          } else if (state) {
            console.log(
              "[Auth] State rehydrated, user:",
              state.user?.id || "none",
            );
            // Rehydration complete - will be marked in setTimeout above
          }
        };
      },
    },
  ),
);

// Export helper to check if rehydration is complete
export const waitForRehydration = async (): Promise<void> => {
  if (rehydrationPromise) {
    await rehydrationPromise;
  }
  // Additional check - wait until isRehydrating is false
  while (isRehydrating) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

// Export helper to flush storage before reload
export const flushAuthStorage = async (): Promise<void> => {
  try {
    // Wait for any pending rehydration
    await waitForRehydration();

    // Force Zustand to persist current state by triggering a state update
    // This ensures the persist middleware runs and writes to storage
    const state = useAuthStore.getState();
    if (state.user) {
      // Small state update to trigger persist middleware
      useAuthStore.setState({ user: state.user });
      // Give Zustand persist middleware time to write
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // MMKV is synchronous and immediately persisted, but we add a small delay
    // to ensure any pending async operations complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    console.log("[Auth] Storage flushed, ready for reload");
  } catch (error) {
    console.error("[Auth] Error flushing storage:", error);
  }
};
