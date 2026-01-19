/**
 * Better Auth Client for Expo
 *
 * Use this client in React components to handle authentication.
 * Provides hooks and methods for sign in, sign up, sign out, and session management.
 * Automatically syncs with Zustand auth store on sign in/up/out.
 */

import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
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
      isVerified: user.emailVerified || false,
      postsCount: user.postsCount || 0,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
    });
  } else {
    setUser(null);
  }
}

// Wrapped sign in that syncs to store
export const signIn = {
  email: async (params: { email: string; password: string }) => {
    const result = await rawSignIn.email(params);
    if (result.data?.user) {
      syncUserToStore(result.data.user);
    }
    return result;
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

// Wrapped sign up that syncs to store
export const signUp = {
  email: async (params: { email: string; password: string; name: string }) => {
    const result = await rawSignUp.email(params);
    if (result.data?.user) {
      syncUserToStore(result.data.user);
    }
    return result;
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
