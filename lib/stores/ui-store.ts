import { create } from "zustand"

type ScreenName = 
  | "profile" 
  | "activity" 
  | "events" 
  | "search" 
  | "messages" 
  | "chat" 
  | "postDetail"
  | "userProfile"

interface UIState {
  loadingScreens: Record<ScreenName, boolean>
  searchingState: boolean
  
  setScreenLoading: (screen: ScreenName, loading: boolean) => void
  setSearching: (searching: boolean) => void
  isScreenLoading: (screen: ScreenName) => boolean
  resetScreenLoading: (screen: ScreenName) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  loadingScreens: {
    profile: true,
    activity: true,
    events: true,
    search: true,
    messages: true,
    chat: true,
    postDetail: true,
    userProfile: true,
  },
  searchingState: false,

  setScreenLoading: (screen, loading) =>
    set((state) => ({
      loadingScreens: { ...state.loadingScreens, [screen]: loading },
    })),

  setSearching: (searching) => set({ searchingState: searching }),

  isScreenLoading: (screen) => get().loadingScreens[screen] ?? true,

  resetScreenLoading: (screen) =>
    set((state) => ({
      loadingScreens: { ...state.loadingScreens, [screen]: true },
    })),
}))
