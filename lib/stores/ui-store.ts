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
  | "stories"

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface UIState {
  loadingScreens: Record<ScreenName, boolean>
  searchingState: boolean
  toasts: Toast[]
  
  setScreenLoading: (screen: ScreenName, loading: boolean) => void
  setSearching: (searching: boolean) => void
  isScreenLoading: (screen: ScreenName) => boolean
  resetScreenLoading: (screen: ScreenName) => void
  showToast: (type: ToastType, title: string, description?: string) => void
  dismissToast: (id: string) => void
  clearToasts: () => void
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
    stories: true,
  },
  searchingState: false,
  toasts: [],

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

  showToast: (type, title, description) => {
    const id = Date.now().toString()
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, description }],
    }))
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, 3000)
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}))
