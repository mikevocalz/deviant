import { create } from "zustand"

interface MediaAsset {
  id: string
  uri: string
  type: "image" | "video"
}

interface CreateStoryState {
  selectedMedia: string[]
  mediaTypes: ("image" | "video")[]
  mediaAssets: MediaAsset[]
  text: string
  textColor: string
  backgroundColor: string
  isUploading: boolean
  uploadProgress: number
  showMediaPicker: boolean
  currentIndex: number
  setSelectedMedia: (media: string[], types: ("image" | "video")[]) => void
  setMediaAssets: (assets: MediaAsset[]) => void
  setText: (text: string) => void
  setTextColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setShowMediaPicker: (show: boolean) => void
  setCurrentIndex: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void
  startUpload: () => void
  setUploadProgress: (progress: number) => void
  finishUpload: () => void
  reset: () => void
}

const initialState = {
  selectedMedia: [] as string[],
  mediaTypes: [] as ("image" | "video")[],
  mediaAssets: [] as MediaAsset[],
  text: "",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  isUploading: false,
  uploadProgress: 0,
  showMediaPicker: false,
  currentIndex: 0,
}

export const useCreateStoryStore = create<CreateStoryState>((set, get) => ({
  ...initialState,

  setSelectedMedia: (media, types) => set({ selectedMedia: media, mediaTypes: types }),
  setMediaAssets: (assets) => set({ mediaAssets: assets }),
  setText: (text) => set({ text }),
  setTextColor: (color) => set({ textColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setShowMediaPicker: (show) => set({ showMediaPicker: show }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  nextSlide: () => {
    const { currentIndex, mediaAssets } = get()
    if (currentIndex < mediaAssets.length - 1) {
      set({ currentIndex: currentIndex + 1 })
    }
  },
  prevSlide: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },
  startUpload: () => set({ isUploading: true, uploadProgress: 0 }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  finishUpload: () => set({ isUploading: false, uploadProgress: 100 }),
  reset: () => set(initialState),
}))
