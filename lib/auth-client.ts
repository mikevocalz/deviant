/**
 * Auth Client for Expo - Supabase Implementation
 *
 * Use this client in React components to handle authentication.
 * Provides hooks and methods for sign in, sign up, sign out, and session management.
 * Automatically syncs with Zustand auth store on sign in/up/out.
 */

import { QueryClient } from "@tanstack/react-query";
import { auth, type AppUser } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase/client";

// Reference to the global query client (set by the app)
let globalQueryClient: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

// Clear all cached data when switching users - MUST be called before setting new user
function clearAllCachedData() {
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

// Re-export auth functions from Supabase auth module
export { auth };

// Get current session
export async function getSession() {
  return auth.getSession();
}

// Get auth token from Supabase session
export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error("[Auth] Error getting auth token:", error);
    return null;
  }
}

// Sign out and clear all data
export async function signOut() {
  clearAllCachedData();
  await auth.signOut();
}

// Type exports
export type { AppUser };
