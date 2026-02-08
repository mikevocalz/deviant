import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  storage,
  clearAuthStorage,
  clearUserDataFromStorage,
} from "@/lib/utils/storage";
import { authClient, handleSignOut, type AppUser } from "@/lib/auth-client";
import { auth } from "@/lib/api/auth";
import { syncAuthUser } from "@/lib/api/privileged";
import { clearUserRowCache } from "@/lib/auth/identity";

/**
 * Extract avatar URL from various formats:
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
          await handleSignOut();
        } catch (error) {
          console.error("[AuthStore] logout error:", error);
        }
        // CRITICAL: Clear persisted state immediately to prevent identity leak
        // If another user logs in on this device, they must NOT see stale data
        set({ user: null, isAuthenticated: false });
        clearAuthStorage();
        clearUserDataFromStorage();
        clearUserRowCache();
      },

      loadAuthState: async () => {
        console.log("[AuthStore] loadAuthState");
        try {
          // Check for stored session using Better Auth
          const { data: session, error: sessionError } =
            await authClient.getSession();

          if (sessionError || !session) {
            console.log("[AuthStore] No active session found");
            set({ user: null, isAuthenticated: false });
            clearUserRowCache();
            return;
          }

          if (session?.user) {
            const sessionAuthId = session.user.id;
            console.log("[AuthStore] Found session for user:", sessionAuthId);

            // CRITICAL: Identity isolation check
            // If persisted user doesn't match the current session, clear stale data
            // This prevents User A's data from showing when User B logs in
            // NOTE: persistedUser.id is the integer PK, session.user.id is the Better Auth UUID
            // — they are DIFFERENT ID systems. Compare using email which is stable across both.
            const persistedUser = get().user;
            if (
              persistedUser &&
              persistedUser.email &&
              session.user.email &&
              persistedUser.email !== session.user.email
            ) {
              console.warn(
                `[AuthStore] IDENTITY MISMATCH: persisted=${persistedUser.email} vs session=${session.user.email}. Clearing stale data.`,
              );
              set({ user: null, isAuthenticated: false });
              clearUserRowCache();
            }

            // Sync user via Edge Function - this ensures we have a valid users row
            // with the correct auth_id mapping
            try {
              const syncedUser = await syncAuthUser();
              console.log(
                "[AuthStore] User synced via Edge Function, ID:",
                syncedUser.id,
              );
              set({
                user: syncedUser,
                isAuthenticated: true,
              });
              return;
            } catch (syncError) {
              console.warn(
                "[AuthStore] auth-sync failed, falling back to direct fetch:",
                syncError,
              );
            }

            // Fallback: Try direct profile fetch if Edge Function fails
            const payloadProfile = await auth.getProfile(
              session.user.id,
              session.user.email,
            );

            if (payloadProfile) {
              console.log(
                "[AuthStore] Payload profile loaded, ID:",
                payloadProfile.id,
              );
              set({
                user: payloadProfile,
                isAuthenticated: true,
              });
            } else {
              // Last resort: Use Better Auth data directly
              console.warn(
                "[AuthStore] Could not load profile, using Better Auth data",
              );
              const user = session.user;
              const profile: AppUser = {
                id: user.id,
                email: user.email,
                username: (user as any).username || user.email.split("@")[0],
                name: user.name || "",
                avatar: user.image || "",
                bio: (user as any).bio || "",
                website: "",
                location: (user as any).location || "",
                hashtags: [],
                isVerified: (user as any).verified || false,
                postsCount: (user as any).postsCount || 0,
                followersCount: (user as any).followersCount || 0,
                followingCount: (user as any).followingCount || 0,
              };
              set({
                user: profile,
                isAuthenticated: true,
              });
            }
          } else {
            console.log("[AuthStore] No active session found");
            set({ user: null, isAuthenticated: false });
            clearUserRowCache();
          }
        } catch (error) {
          console.error("[AuthStore] loadAuthState error:", error);
          set({ user: null, isAuthenticated: false });
          clearUserRowCache();
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

// Better Auth handles session state internally via the client
// No need for manual auth state listener - the useSession hook is reactive

export const waitForRehydration = async (): Promise<void> => {
  // Simple wait - Zustand handles this automatically
  await new Promise((resolve) => setTimeout(resolve, 100));
};

export const flushAuthStorage = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
};
