import { create } from "zustand"

interface AppState {
  appReady: boolean
  splashAnimationFinished: boolean
  setAppReady: (ready: boolean) => void
  setSplashAnimationFinished: (finished: boolean) => void
  onAnimationFinish: (isCancelled: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  appReady: false,
  splashAnimationFinished: false,
  setAppReady: (ready) => set({ appReady: ready }),
  setSplashAnimationFinished: (finished) => set({ splashAnimationFinished: finished }),
  onAnimationFinish: (isCancelled) => {
    if (!isCancelled) {
      set({ splashAnimationFinished: true })
    }
  },
}))
