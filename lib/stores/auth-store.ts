import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { storage } from "@/lib/utils/storage"

interface User {
  id: string
  email: string
  username: string
  name: string
  avatar?: string
  isVerified: boolean
}

interface AuthStore {
  user: User | null
  hasSeenOnboarding: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setHasSeenOnboarding: (seen: boolean) => void
  logout: () => void
  loadAuthState: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      hasSeenOnboarding: false,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),
      logout: () => set({ user: null, isAuthenticated: false }),
      loadAuthState: async () => {
        // State is automatically loaded from storage
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => storage),
    },
  ),
)
