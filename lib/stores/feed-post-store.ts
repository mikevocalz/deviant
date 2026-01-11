import { create } from "zustand"

interface VideoState {
  showSeekBar: boolean
  currentTime: number
  duration: number
}

interface FeedPostUIState {
  pressedPosts: Record<string, boolean>
  likeAnimatingPosts: Record<string, boolean>
  videoStates: Record<string, VideoState>
  previewMedia: { type: "image" | "video"; uri: string } | null
  showPreviewModal: boolean

  setPressedPost: (postId: string, pressed: boolean) => void
  setLikeAnimating: (postId: string, animating: boolean) => void
  setVideoState: (postId: string, state: Partial<VideoState>) => void
  getVideoState: (postId: string) => VideoState
  setPreviewMedia: (media: { type: "image" | "video"; uri: string } | null) => void
  setShowPreviewModal: (show: boolean) => void
  resetVideoState: (postId: string) => void
}

const defaultVideoState: VideoState = {
  showSeekBar: false,
  currentTime: 0,
  duration: 0,
}

export const useFeedPostUIStore = create<FeedPostUIState>((set, get) => ({
  pressedPosts: {},
  likeAnimatingPosts: {},
  videoStates: {},
  previewMedia: null,
  showPreviewModal: false,

  setPressedPost: (postId, pressed) =>
    set((state) => ({
      pressedPosts: { ...state.pressedPosts, [postId]: pressed },
    })),

  setLikeAnimating: (postId, animating) =>
    set((state) => ({
      likeAnimatingPosts: { ...state.likeAnimatingPosts, [postId]: animating },
    })),

  setVideoState: (postId, newState) =>
    set((state) => ({
      videoStates: {
        ...state.videoStates,
        [postId]: { ...get().getVideoState(postId), ...newState },
      },
    })),

  getVideoState: (postId) => get().videoStates[postId] || defaultVideoState,

  setPreviewMedia: (media) => set({ previewMedia: media }),

  setShowPreviewModal: (show) => set({ showPreviewModal: show }),

  resetVideoState: (postId) =>
    set((state) => ({
      videoStates: { ...state.videoStates, [postId]: defaultVideoState },
    })),
}))
