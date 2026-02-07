/**
 * Better Auth Client for Expo
 *
 * Use this client in React components to handle authentication.
 * Provides hooks and methods for sign in, sign up, sign out, and session management.
 */

import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { usernameClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import * as SecureStore from "expo-secure-store";
import { QueryClient } from "@tanstack/react-query";

// Auth server URL — Better Auth hosted in Supabase Edge Function (CANONICAL)
// IMPORTANT: Better Auth client uses baseURL as origin-only and appends basePath.
// baseURL MUST be just the origin (no path), basePath routes through the Edge Function.
const AUTH_FULL_URL =
  process.env.EXPO_PUBLIC_AUTH_URL ||
  "https://npfjanxturvmjyevoyfo.supabase.co/functions/v1/auth";

// Extract origin from the full URL (e.g. "https://npfjanxturvmjyevoyfo.supabase.co")
const AUTH_ORIGIN = new URL(AUTH_FULL_URL).origin;
// Extract the path prefix (e.g. "/functions/v1/auth") and append Better Auth's route prefix
const AUTH_PATH_PREFIX = new URL(AUTH_FULL_URL).pathname.replace(/\/$/, "");
const AUTH_BASE_PATH = `${AUTH_PATH_PREFIX}/api/auth`;

console.log("[AuthClient] AUTH_ORIGIN:", AUTH_ORIGIN);
console.log("[AuthClient] AUTH_BASE_PATH:", AUTH_BASE_PATH);

// Create the Better Auth client
export const authClient = createAuthClient({
  baseURL: AUTH_ORIGIN,
  basePath: AUTH_BASE_PATH,
  plugins: [
    expoClient({
      scheme: "dvnt",
      storagePrefix: "dvnt",
      storage: SecureStore,
      cookiePrefix: ["dvnt", "better-auth"],
    }),
    usernameClient(),
    passkeyClient(),
  ],
});

// Export hooks and methods
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// Reference to the global query client (set by the app)
let globalQueryClient: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

// Clear all cached data when switching users
export function clearAllCachedData() {
  console.log("[Auth] === CLEARING ALL USER DATA ===");

  // 1. Clear React Query cache FIRST
  if (globalQueryClient) {
    globalQueryClient.cancelQueries();
    globalQueryClient.removeQueries();
    globalQueryClient.clear();
    globalQueryClient.resetQueries();
    console.log("[Auth] ✓ React Query cache cleared");
  }

  // 2. Clear persisted storage (MMKV)
  try {
    const { clearUserDataFromStorage } = require("@/lib/utils/storage");
    clearUserDataFromStorage();
    console.log("[Auth] ✓ MMKV storage cleared");
  } catch (e) {
    console.error("[Auth] ✗ Failed to clear MMKV storage:", e);
  }

  // 3. Reset Zustand stores
  try {
    const { useProfileStore } = require("@/lib/stores/profile-store");
    const { useFeedPostUIStore } = require("@/lib/stores/feed-post-store");
    const {
      useFeedSlideStore,
      usePostStore,
    } = require("@/lib/stores/post-store");
    const { useBookmarkStore } = require("@/lib/stores/bookmark-store");

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

    useFeedPostUIStore.setState({
      pressedPosts: {},
      likeAnimatingPosts: {},
      videoStates: {},
      previewMedia: null,
      showPreviewModal: false,
      activePostId: null,
      isMuted: true,
    });

    useFeedSlideStore.setState({ currentSlides: {} });
    usePostStore.setState({
      likedPosts: [],
      postLikeCounts: {},
      postCommentCounts: {},
      likedComments: [],
      commentLikeCounts: {},
    });
    useBookmarkStore.setState({ bookmarkedPosts: [] });

    console.log("[Auth] === ALL USER DATA CLEARED ===");
  } catch (error) {
    console.error("[Auth] Error resetting stores:", error);
  }
}

// Sign out and clear all data
export async function handleSignOut() {
  clearAllCachedData();
  await signOut();
}

// Get auth token for API requests
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data: session } = await authClient.getSession();
    return session?.session?.token || null;
  } catch (error) {
    console.error("[Auth] Error getting auth token:", error);
    return null;
  }
}

// App user type for compatibility
export interface AppUser {
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
