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

const BASE_URL = process.env.EXPO_PUBLIC_AUTH_URL || "http://localhost:8081";

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
function getStorage() {
  if (Platform.OS === "web") {
    return webStorage;
  }
  // Lazy require to avoid bundling native module on web
  const SecureStore = require("expo-secure-store");
  return SecureStore;
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
  }) => {
    console.log("[Auth] Starting signup for:", params.email);
    try {
      // Use server's public registration endpoint
      const response = await fetch(`${BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          username: params.username || params.email.split("@")[0],
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

// Wrapped sign out that clears store
export const signOut = async () => {
  const result = await rawSignOut();
  const { logout } = useAuthStore.getState();
  logout();
  return result;
};

// Helper to get cookies for authenticated requests
export function getAuthCookies(): string | null {
  return authClient.getCookie();
}

// Get auth token from storage
export async function getAuthToken(): Promise<string | null> {
  try {
    const storage = getStorage();
    if (Platform.OS === "web") {
      return storage.getItem("dvnt_auth_token");
    }
    return await storage.getItem("dvnt_auth_token");
  } catch (error) {
    console.error("[Auth] Error getting auth token:", error);
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
