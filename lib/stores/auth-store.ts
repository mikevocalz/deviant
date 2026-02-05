import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/utils/storage";
import { authClient, handleSignOut, type AppUser } from "@/lib/auth-client";
import { auth } from "@/lib/api/auth";

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
        set({ user: null, isAuthenticated: false });
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
            return;
          }

          if (session?.user) {
            console.log("[AuthStore] Found session for user:", session.user.id);

            // Fetch the Payload CMS profile to get the integer ID
            // The Better Auth user.id is a UUID, but we need the Payload CMS integer ID
            const payloadProfile = await auth.getProfile(session.user.id);

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
              // Fallback to Better Auth data if profile fetch fails
              console.warn(
                "[AuthStore] Could not load Payload profile, using Better Auth data",
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

// Better Auth handles session state internally via the client
// No need for manual auth state listener - the useSession hook is reactive

export const waitForRehydration = async (): Promise<void> => {
  // Simple wait - Zustand handles this automatically
  await new Promise((resolve) => setTimeout(resolve, 100));
};

export const flushAuthStorage = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
};
