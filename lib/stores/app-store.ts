import { create } from "zustand"
import AsyncStorage from "@react-native-async-storage/async-storage"

const NSFW_STORAGE_KEY = "app_nsfw_enabled"

interface AppState {
  appReady: boolean
  splashAnimationFinished: boolean
  nsfwEnabled: boolean
  nsfwLoaded: boolean
  setAppReady: (ready: boolean) => void
  setSplashAnimationFinished: (finished: boolean) => void
  onAnimationFinish: (isCancelled: boolean) => void
  setNsfwEnabled: (enabled: boolean) => void
  loadNsfwSetting: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  appReady: false,
  splashAnimationFinished: false,
  nsfwEnabled: false,
  nsfwLoaded: false,
  setAppReady: (ready) => set({ appReady: ready }),
  setSplashAnimationFinished: (finished) => set({ splashAnimationFinished: finished }),
  onAnimationFinish: (isCancelled) => {
    if (!isCancelled) {
      set({ splashAnimationFinished: true })
    }
  },
  setNsfwEnabled: async (enabled) => {
    set({ nsfwEnabled: enabled })
    try {
      await AsyncStorage.setItem(NSFW_STORAGE_KEY, JSON.stringify(enabled))
    } catch (error) {
      console.log("Error saving NSFW setting:", error)
    }
  },
  loadNsfwSetting: async () => {
    try {
      const stored = await AsyncStorage.getItem(NSFW_STORAGE_KEY)
      if (stored !== null) {
        set({ nsfwEnabled: JSON.parse(stored), nsfwLoaded: true })
      } else {
        set({ nsfwLoaded: true })
      }
    } catch (error) {
      console.log("Error loading NSFW setting:", error)
      set({ nsfwLoaded: true })
    }
  },
}))
