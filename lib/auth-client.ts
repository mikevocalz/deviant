/**
 * Better Auth Client for Expo
 *
 * Use this client in React components to handle authentication.
 * Provides hooks and methods for sign in, sign up, sign out, and session management.
 * Automatically syncs with Zustand auth store on sign in/up/out.
 */

import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { usernameClient } from "better-auth/client/plugins";
import { Platform } from "react-native";
import { useAuthStore } from "@/lib/stores/auth-store";
import { QueryClient } from "@tanstack/react-query";
import {
  validateDateOfBirth,
  UNDERAGE_ERROR_MESSAGE,
} from "@/lib/utils/age-verification";

// Reference to the global query client (set by the app)
let globalQueryClient: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

// Clear all cached data when switching users - MUST be called before setting new user
function clearAllCachedData() {
  console.log("[Auth] === CLEARING ALL USER DATA ===");

  // 1. Clear React Query cache FIRST - use multiple methods to ensure it's truly cleared
  if (globalQueryClient) {
    // Cancel all active queries first
    globalQueryClient.cancelQueries();
    // Remove all queries from cache
    globalQueryClient.removeQueries();
    // Clear the entire cache
    globalQueryClient.clear();
    // Reset the query client state completely
    globalQueryClient.resetQueries();
    console.log(
      "[Auth] ✓ React Query cache cleared (cancel + remove + clear + reset)",
    );
  } else {
    console.warn("[Auth] ⚠ QueryClient not available for clearing");
  }

  // 2. Clear persisted storage (MMKV) - this is critical for user data isolation
  try {
    const { clearUserDataFromStorage } = require("@/lib/utils/storage");
    clearUserDataFromStorage();
    console.log("[Auth] ✓ MMKV storage cleared");
  } catch (e) {
    console.error("[Auth] ✗ Failed to clear MMKV storage:", e);
  }

  // 3. Reset Zustand stores that hold user-specific data (sync, not async)
  try {
    // Import stores synchronously to ensure immediate reset
    const { useProfileStore } = require("@/lib/stores/profile-store");
    const { useFeedPostUIStore } = require("@/lib/stores/feed-post-store");
    const {
      useFeedSlideStore,
      usePostStore,
    } = require("@/lib/stores/post-store");
    const { useBookmarkStore } = require("@/lib/stores/bookmark-store");

    // Reset profile store
    useProfileStore.setState({
      activeTab: "posts",
      following: {},
      followers: {},
      editName: "",
      editBio: "",
      editWebsite: "",
      editLocation: "",
      editHashtags: [],
    });
    console.log("[Auth] ✓ Profile store reset");

    // Reset feed UI stores
    useFeedPostUIStore.setState({
      pressedPosts: {},
      likeAnimatingPosts: {},
      videoStates: {},
      previewMedia: null,
      showPreviewModal: false,
      activePostId: null,
      isMuted: true,
    });

    useFeedSlideStore.setState({
      currentSlides: {},
    });
    console.log("[Auth] ✓ Feed UI stores reset");

    // Reset post store (liked posts, like counts, etc.)
    usePostStore.setState({
      likedPosts: [],
      postLikeCounts: {},
      postCommentCounts: {},
      likedComments: [],
      commentLikeCounts: {},
    });
    console.log("[Auth] ✓ Post store reset");

    // Reset bookmark store
    useBookmarkStore.setState({
      bookmarkedPosts: [],
    });
    console.log("[Auth] ✓ Bookmark store reset");

    console.log("[Auth] === ALL USER DATA CLEARED ===");
  } catch (error) {
    console.error("[Auth] Error resetting stores:", error);
  }
}

// CRITICAL: Import canonical URL resolver - single source of truth
import { getAuthBaseUrl } from "@/lib/api-config";

// Production URL using canonical resolver - NEVER returns empty/localhost
const BASE_URL = getAuthBaseUrl();

// Hard guard - fail fast if configuration is invalid
if (!BASE_URL || !BASE_URL.startsWith("https://")) {
  throw new Error(
    `[Auth] CRITICAL: Invalid auth configuration. BASE_URL="${BASE_URL}" is not a valid HTTPS URL.`,
  );
}

// Log the resolved URL at startup for debugging
console.log("[Auth] BASE_URL resolved to:", BASE_URL);

// Web-compatible storage fallback for SSR/web builds
const webStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  },
  deleteItem: (key: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};

// Dynamically get storage based on platform
// CRITICAL: Wraps expo-secure-store to use consistent method names
function getStorage() {
  if (Platform.OS === "web") {
    return webStorage;
  }
  // Lazy require to avoid bundling native module on web
  const SecureStore = require("expo-secure-store");
  // Wrap SecureStore to match our interface (getItem/setItem/deleteItem)
  // SecureStore uses getItemAsync/setItemAsync/deleteItemAsync
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) =>
      SecureStore.setItemAsync(key, value),
    deleteItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    expoClient({
      scheme: "dvnt",
      storagePrefix: "dvnt",
      storage: getStorage(),
    }),
    usernameClient(),
  ],
});

// Raw methods from authClient
const {
  signIn: rawSignIn,
  signUp: rawSignUp,
  signOut: rawSignOut,
} = authClient;

// Export hooks directly
export const { useSession, getSession } = authClient;

// Helper to sync user to Zustand store
function syncUserToStore(
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified?: boolean;
    username?: string;
    bio?: string;
    website?: string;
    location?: string;
    hashtags?: string[];
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
  } | null,
) {
  const { setUser } = useAuthStore.getState();

  if (user) {
    setUser({
      id: user.id,
      email: user.email,
      username: user.username || user.email.split("@")[0],
      name: user.name,
      avatar: user.image || undefined,
      bio: user.bio || "",
      website: user.website || "",
      location: user.location || "",
      hashtags: Array.isArray(user.hashtags) ? user.hashtags : [],
      isVerified: user.emailVerified || false,
      postsCount: user.postsCount || 0,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
    });
  } else {
    setUser(null);
  }
}

// Wrapped sign in using Payload CMS auth
export const signIn = {
  email: async (params: { email: string; password: string }) => {
    console.log("[Auth] Starting login for:", params.email);
    console.log("[Auth] BASE_URL:", BASE_URL);
    try {
      // Use Payload CMS login endpoint
      const response = await fetch(`${BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
        }),
      });

      const data = await response.json();
      console.log("[Auth] Login response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg =
          data.errors?.[0]?.message || data.message || "Login failed";
        console.error("[Auth] Login error:", errorMsg);
        return { error: { message: errorMsg }, data: null };
      }

      if (data.user) {
        console.log("[Auth] User logged in:", data.user.id);
        // Clear cached data from previous user before setting new user
        clearAllCachedData();
        syncUserToStore({
          id: String(data.user.id),
          email: data.user.email,
          name: data.user.firstName || data.user.username,
          username: data.user.username,
          emailVerified: data.user.verified || false,
          image: data.user.avatar,
          bio: data.user.bio,
          postsCount: data.user.postsCount,
          followersCount: data.user.followersCount,
          followingCount: data.user.followingCount,
        });

        // Store the JWT token
        const storage = getStorage();
        if (data.token) {
          await storage.setItem("dvnt_auth_token", data.token);
        }
      }

      return { error: null, data: { user: data.user, token: data.token } };
    } catch (error: any) {
      console.error("[Auth] Login exception:", error?.message || error);
      throw error;
    }
  },
  social: async (params: {
    provider: "google" | "apple" | "facebook";
    callbackURL?: string;
    idToken?: { token: string; nonce?: string };
  }) => {
    const result = await rawSignIn.social(params);
    // Social sign-in may redirect, only sync if we have user data
    if (result.data && "user" in result.data && result.data.user) {
      syncUserToStore(result.data.user);
    }
    return result;
  },
};

// Wrapped sign up using server registration endpoint
export const signUp = {
  email: async (params: {
    email: string;
    password: string;
    name: string;
    username?: string;
    dateOfBirth?: string;
  }) => {
    console.log("[Auth] Starting signup for:", params.email);

    // CRITICAL: Client-side age verification before sending to server
    // This is a defense-in-depth measure - server also validates
    if (params.dateOfBirth) {
      const ageCheck = validateDateOfBirth(params.dateOfBirth);
      if (!ageCheck.isValid || ageCheck.isOver18 === false) {
        console.error("[Auth] BLOCKED: Underage user attempted signup");
        return {
          error: { message: UNDERAGE_ERROR_MESSAGE },
          data: null,
        };
      }
    }

    try {
      // Use server's public registration endpoint
      const response = await fetch(`${BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          username: params.username || params.email.split("@")[0],
          dateOfBirth: params.dateOfBirth, // Send DOB to server for validation
        }),
      });

      const data = await response.json();
      console.log("[Auth] Signup response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg =
          data.error || data.errors?.[0]?.message || "Registration failed";
        console.error("[Auth] Signup error:", errorMsg);
        return { error: { message: errorMsg }, data: null };
      }

      if (data.user) {
        console.log("[Auth] User created:", data.user.id);
        // Clear cached data from previous user before setting new user
        clearAllCachedData();
        syncUserToStore({
          id: String(data.user.id),
          email: data.user.email,
          name: params.name || data.user.username,
          username: data.user.username,
          emailVerified: data.user.verified || false,
          image: data.user.avatar,
        });

        // Store the JWT token
        const storage = getStorage();
        if (data.token) {
          await storage.setItem("dvnt_auth_token", data.token);
        }
      }

      return { error: null, data: { user: data.user, token: data.token } };
    } catch (error: any) {
      console.error("[Auth] Signup exception:", error?.message || error);
      throw error;
    }
  },
};

// Wrapped sign out that clears ALL user data and store
export const signOut = async () => {
  console.log("[Auth] === SIGNING OUT ===");

  // CRITICAL: Clear ALL cached data FIRST before signing out
  // This ensures no data leakage between users
  clearAllCachedData();

  // Also clear auth storage specifically
  try {
    const { clearAuthStorage } = require("@/lib/utils/storage");
    clearAuthStorage();
    console.log("[Auth] ✓ Auth storage cleared");
  } catch (e) {
    console.error("[Auth] ✗ Failed to clear auth storage:", e);
  }

  // Clear the JWT token from secure store
  try {
    const storage = getStorage();
    await storage.deleteItem("dvnt_auth_token");
    console.log("[Auth] ✓ JWT token cleared");
  } catch (e) {
    console.error("[Auth] ✗ Failed to clear JWT token:", e);
  }

  // Logout from auth store (sets user to null)
  const { logout } = useAuthStore.getState();
  logout();
  console.log("[Auth] ✓ Auth store logged out");

  // Finally call the raw signOut
  try {
    const result = await rawSignOut();
    console.log("[Auth] ✓ Raw signOut completed");
    return result;
  } catch (e) {
    console.error("[Auth] ✗ Raw signOut error (non-fatal):", e);
    return { error: null, data: null };
  }
};

// Helper to get cookies for authenticated requests
export function getAuthCookies(): string | null {
  return authClient.getCookie();
}

// Helper to get auth token for authenticated requests
export async function getAuthToken(): Promise<string | null> {
  try {
    const storage = getStorage();
    const token = await storage.getItem("dvnt_auth_token");
    return token || null;
  } catch {
    return null;
  }
}

// Helper to make authenticated fetch requests
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const cookies = getAuthCookies();

  const headers: HeadersInit = {
    ...options.headers,
  };

  if (cookies) {
    (headers as Record<string, string>)["Cookie"] = cookies;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "omit", // Use manual cookie handling
  });
}

// Type exports
export type AuthSession = Awaited<ReturnType<typeof authClient.getSession>>;
export type AuthUser = NonNullable<AuthSession>["data"]["user"];
