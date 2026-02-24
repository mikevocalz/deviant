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

        // CRITICAL: Wait for Zustand MMKV rehydration before reading persisted state.
        // Without this, get().user returns the initial value (null) because the async
        // MMKV read hasn't completed yet. Every guard that checks "is there a persisted
        // user?" would fail, causing an immediate sign-out on every cold start.
        if (!get()._hasHydrated) {
          console.log(
            "[AuthStore] Waiting for rehydration before loadAuthState...",
          );
          await new Promise<void>((resolve) => {
            const unsub = useAuthStore.subscribe((s) => {
              if (s._hasHydrated) {
                unsub();
                resolve();
              }
            });
            // Safety: if already hydrated by now (race), resolve immediately
            if (useAuthStore.getState()._hasHydrated) {
              unsub();
              resolve();
            }
          });
          console.log(
            "[AuthStore] Rehydration complete, persisted user:",
            get().user?.id || "none",
          );
        }

        try {
          // Check for stored session using Better Auth
          const { data: session, error: sessionError } =
            await authClient.getSession();

          // CRITICAL: Network error ≠ no session.
          // The Better Auth edge function cold-starts on restart and can fail
          // on the first call. If we have a persisted user, keep them authenticated
          // rather than signing them out due to a transient network failure.
          if (sessionError) {
            console.warn("[AuthStore] getSession network error:", sessionError);
            const persistedUser = get().user;
            if (persistedUser) {
              console.log(
                "[AuthStore] Keeping persisted user despite getSession error:",
                persistedUser.id,
              );
              set({
                isAuthenticated: true,
                authStatus: "authenticated" as AuthStatus,
              });
              return;
            }
            // No persisted user — genuinely unauthenticated
            set({
              user: null,
              isAuthenticated: false,
              authStatus: "unauthenticated" as AuthStatus,
            });
            return;
          }

          if (!session) {
            console.log("[AuthStore] No active session found");
            // CRITICAL: If we have a persisted user, keep them authenticated.
            // getSession returning null does NOT mean "user logged out" — it can
            // mean the SecureStore token expired, was cleared by iOS, or the
            // Better Auth edge function returned empty. Never sign out a persisted
            // user based solely on a null session — require an explicit logout action.
            const persistedOnNoSession = get().user;
            if (persistedOnNoSession) {
              console.log(
                "[AuthStore] No session but persisted user exists — staying authenticated:",
                persistedOnNoSession.id,
              );
              set({
                isAuthenticated: true,
                authStatus: "authenticated" as AuthStatus,
              });
              return;
            }
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
            // NOTE: No setTimeout — retry immediately (first attempt already waited on network)
            try {
              const { syncAuthUser } = require("@/lib/api/privileged");
              let syncedUser;
              try {
                syncedUser = await syncAuthUser();
              } catch (firstError) {
                console.warn(
                  "[AuthStore] auth-sync attempt 1 failed, retrying immediately:",
                  firstError,
                );
                // Retry immediately — the first call already paid the cold-start cost
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
              // If we have a persisted user, keep them authenticated while sync recovers
              const persistedOnSyncFail = get().user;
              if (persistedOnSyncFail) {
                console.log(
                  "[AuthStore] auth-sync failed but persisted user exists — staying authenticated",
                );
                set({
                  isAuthenticated: true,
                  authStatus: "authenticated" as AuthStatus,
                });
                return;
              }
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
            console.log("[AuthStore] Session exists but no user object");
            // Same guard: keep persisted user if available
            const persistedNoUser = get().user;
            if (persistedNoUser) {
              console.log(
                "[AuthStore] Session.user empty but persisted user exists — staying authenticated:",
                persistedNoUser.id,
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
              const {
                clearUserRowCache: clearCache2,
              } = require("@/lib/auth/identity");
              clearCache2();
            }
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
          // Mark hydration complete via microtask — store is available after
          // create() returns, which happens synchronously before this callback fires.
          Promise.resolve().then(() => {
            try {
              useAuthStore.setState({ _hasHydrated: true });
            } catch (e) {
              console.warn("[AuthStore] setState failed:", e);
            }
          });
        };
      },
    },
  ),
);

// Better Auth handles session state internally via the client
// No need for manual auth state listener - the useSession hook is reactive

export const waitForRehydration = async (): Promise<void> => {
  // Wait for Zustand MMKV rehydration to complete
  if (useAuthStore.getState()._hasHydrated) return;
  await new Promise<void>((resolve) => {
    const unsub = useAuthStore.subscribe((s) => {
      if (s._hasHydrated) {
        unsub();
        resolve();
      }
    });
  });
};

export const flushAuthStorage = async (): Promise<void> => {
  // No-op — MMKV writes are synchronous, nothing to flush
};
