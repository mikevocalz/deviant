import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  storage,
  clearAuthStorage,
  clearUserDataFromStorage,
} from "@/lib/utils/storage";
import { authClient, handleSignOut, type AppUser } from "@/lib/auth-client";
import { auth } from "@/lib/api/auth";
// NOTE: syncAuthUser and clearUserRowCache are imported LAZILY (inline)
// to break the require cycle: auth-store -> privileged -> identity -> auth-store

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthStore {
  user: AppUser | null;
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  _hasHydrated: boolean;
  setUser: (user: AppUser | null) => void;
  updateUser: (updates: Partial<AppUser>) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  setHasHydrated: (v: boolean) => void;
  logout: () => void;
  loadAuthState: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      hasSeenOnboarding: false,
      isAuthenticated: false,
      authStatus: "loading" as AuthStatus,
      _hasHydrated: false,

      setUser: (user) => {
        console.log("[AuthStore] setUser:", user?.id || "null");
        const status: AuthStatus = user ? "authenticated" : "unauthenticated";
        set({ user, isAuthenticated: !!user, authStatus: status });
      },

      setHasHydrated: (v) => set({ _hasHydrated: v }),

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
        const { clearUserRowCache } = require("@/lib/auth/identity");
        clearUserRowCache();
      },

      loadAuthState: async () => {
        console.log("[AuthStore] loadAuthState");
        // CRITICAL: Set loading at the START — UI must not render protected routes
        // until this function completes. Do NOT set isAuthenticated during loading.
        set({ authStatus: "loading" as AuthStatus });
        try {
          // Check for stored session using Better Auth
          const { data: session, error: sessionError } =
            await authClient.getSession();

          if (sessionError || !session) {
            console.log("[AuthStore] No active session found");
            set({
              user: null,
              isAuthenticated: false,
              authStatus: "unauthenticated" as AuthStatus,
            });
            const { clearUserRowCache } = require("@/lib/auth/identity");
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
              // Don't set authStatus here — let the rest of loadAuthState handle it
              set({ user: null, isAuthenticated: false });
              const {
                clearUserRowCache: clearCache,
              } = require("@/lib/auth/identity");
              clearCache();
            }

            // Sync user via Edge Function - this ensures we have a valid users row
            // with the correct auth_id mapping
            // Retry once on failure — edge function cold starts can cause the first call to timeout
            try {
              const { syncAuthUser } = require("@/lib/api/privileged");
              let syncedUser;
              try {
                syncedUser = await syncAuthUser();
              } catch (firstError) {
                console.warn(
                  "[AuthStore] auth-sync attempt 1 failed, retrying in 2s:",
                  firstError,
                );
                await new Promise((r) => setTimeout(r, 2000));
                syncedUser = await syncAuthUser();
              }
              console.log(
                "[AuthStore] User synced via Edge Function, ID:",
                syncedUser.id,
              );
              set({
                user: syncedUser,
                isAuthenticated: true,
                authStatus: "authenticated" as AuthStatus,
              });
              return;
            } catch (syncError) {
              console.warn(
                "[AuthStore] auth-sync failed after retry, falling back to direct fetch:",
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
                authStatus: "authenticated" as AuthStatus,
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
                authStatus: "authenticated" as AuthStatus,
              });
            }
          } else {
            console.log("[AuthStore] No active session found");
            set({
              user: null,
              isAuthenticated: false,
              authStatus: "unauthenticated" as AuthStatus,
            });
            const {
              clearUserRowCache: clearCache2,
            } = require("@/lib/auth/identity");
            clearCache2();
          }
        } catch (error) {
          console.error("[AuthStore] loadAuthState error:", error);
          // On error, fall back to persisted state if available
          const persisted = get().user;
          if (persisted) {
            console.log(
              "[AuthStore] Error during load, keeping persisted user",
            );
            set({
              isAuthenticated: true,
              authStatus: "authenticated" as AuthStatus,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              authStatus: "unauthenticated" as AuthStatus,
            });
          }
          const {
            clearUserRowCache: clearCache3,
          } = require("@/lib/auth/identity");
          clearCache3();
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => storage),
      version: 2, // Increment version to force re-hydration
      // CRITICAL: authStatus and _hasHydrated are runtime-only — never persist them
      partialize: (state) => ({
        user: state.user,
        hasSeenOnboarding: state.hasSeenOnboarding,
        isAuthenticated: state.isAuthenticated,
      }),
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
          // Mark hydration complete regardless of error
          // NOTE: Cannot use useAuthStore here synchronously — require cycle means
          // the store variable may not be assigned yet (create() hasn't returned).
          // Use a polling approach to wait until the store is actually available.
          const markHydrated = () => {
            if (typeof useAuthStore !== "undefined" && useAuthStore) {
              try {
                useAuthStore.setState({ _hasHydrated: true });
              } catch (e) {
                console.warn("[AuthStore] setState fallback failed:", e);
              }
            } else {
              setTimeout(markHydrated, 10);
            }
          };
          setTimeout(markHydrated, 0);
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
