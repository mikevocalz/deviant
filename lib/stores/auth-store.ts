import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/utils/storage";
import { supabase } from "@/lib/supabase/client";
import { auth, type AppUser } from "@/lib/api/auth";

/**
 * Extract avatar URL from various formats
 * Payload CMS can return avatar as:
 * - Direct URL string
 * - Media object with url property
 * - null/undefined
 */
function extractAvatarUrl(avatar: unknown): string | undefined {
  if (!avatar) return undefined;

  // Direct string URL
  if (typeof avatar === "string") {
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    // Invalid string format
    return undefined;
  }

  // Media object with url property
  if (typeof avatar === "object" && avatar !== null) {
    const avatarObj = avatar as Record<string, unknown>;
    if (avatarObj.url && typeof avatarObj.url === "string") {
      const url = avatarObj.url;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
    }
  }

  return undefined;
}

interface AuthStore {
  user: AppUser | null;
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  setUser: (user: AppUser | null) => void;
  updateUser: (updates: Partial<AppUser>) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  logout: () => void;
  loadAuthState: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      hasSeenOnboarding: false,
      isAuthenticated: false,

      setUser: (user) => {
        console.log("[AuthStore] setUser:", user?.id || "null");
        set({ user, isAuthenticated: !!user });
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          console.log("[AuthStore] updateUser:", Object.keys(updates));
          set({ user: { ...currentUser, ...updates } });
        }
      },

      setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),

      logout: async () => {
        console.log("[AuthStore] logout");
        try {
          await auth.signOut();
        } catch (error) {
          console.error("[AuthStore] logout error:", error);
        }
        set({ user: null, isAuthenticated: false });
      },

      loadAuthState: async () => {
        console.log("[AuthStore] loadAuthState");
        try {
          // First, check for stored session
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            console.error("[AuthStore] Session error:", sessionError);
            set({ user: null, isAuthenticated: false });
            return;
          }

          if (session?.user) {
            console.log("[AuthStore] Found session for user:", session.user.id);

            // Load user profile
            const profile = await auth.getProfile(session.user.id);

            if (profile) {
              console.log("[AuthStore] Profile loaded:", profile.id);
              set({
                user: profile,
                isAuthenticated: true,
              });
            } else {
              console.log("[AuthStore] No profile found for session user");
              // Don't sign out immediately - give the user a chance
              // In case profile just hasn't been created yet
              set({ user: null, isAuthenticated: false });
            }
          } else {
            console.log("[AuthStore] No active session found");
            set({ user: null, isAuthenticated: false });
          }
        } catch (error) {
          console.error("[AuthStore] loadAuthState error:", error);
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => storage),
      version: 2, // Increment version to force re-hydration
      onRehydrateStorage: () => {
        console.log("[AuthStore] Starting rehydration");

        return (state, error) => {
          if (error) {
            console.error("[AuthStore] Rehydration error:", error);
          } else if (state) {
            console.log(
              "[AuthStore] State rehydrated, user:",
              state.user?.id || "none",
            );
          }
        };
      },
    },
  ),
);

// Setup auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log("[AuthStore] Auth state change:", event);

  if (event === "SIGNED_IN" && session?.user) {
    // Load profile when user signs in
    auth.getProfile(session.user.id).then((profile) => {
      if (profile) {
        useAuthStore.getState().setUser(profile);
      }
    });
  } else if (event === "SIGNED_OUT") {
    useAuthStore.getState().setUser(null);
  } else if (event === "TOKEN_REFRESHED" && session?.user) {
    // Refresh profile on token refresh
    auth.getProfile(session.user.id).then((profile) => {
      if (profile) {
        useAuthStore.getState().setUser(profile);
      }
    });
  }
});

export const waitForRehydration = async (): Promise<void> => {
  // Simple wait - Zustand handles this automatically
  await new Promise((resolve) => setTimeout(resolve, 100));
};

export const flushAuthStorage = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
};
