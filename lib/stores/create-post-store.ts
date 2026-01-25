import { create } from "zustand"
import type { MediaAsset } from "@/lib/hooks/use-media-picker"

interface LocationData {
  name: string
  latitude?: number
  longitude?: number
  placeId?: string
}

interface CreatePostState {
  selectedMedia: MediaAsset[]
  caption: string
  location: string
  locationData: LocationData | null
  taggedPeople: string[]
  isNSFW: boolean
  step: "select" | "edit" | "location"
  isUploading: boolean
  uploadProgress: number
  setSelectedMedia: (media: MediaAsset[]) => void
  addMedia: (media: MediaAsset) => void
  removeMedia: (id: string) => void
  toggleMedia: (media: MediaAsset) => void
  setCaption: (caption: string) => void
  setLocation: (location: string) => void
  setLocationData: (data: LocationData | null) => void
  setTaggedPeople: (people: string[]) => void
  setIsNSFW: (isNSFW: boolean) => void
  setStep: (step: "select" | "edit" | "location") => void
  startUpload: () => void
  setUploadProgress: (progress: number) => void
  finishUpload: () => void
  reset: () => void
}

const initialState = {
  selectedMedia: [] as MediaAsset[],
  caption: "",
  location: "",
  locationData: null as LocationData | null,
  taggedPeople: [] as string[],
  isNSFW: false,
  step: "select" as const,
  isUploading: false,
  uploadProgress: 0,
}

export const useCreatePostStore = create<CreatePostState>((set, get) => ({
  ...initialState,

  setSelectedMedia: (media) => set({ selectedMedia: media }),

  addMedia: (media) => {
    const { selectedMedia } = get()
    if (selectedMedia.length < 10) {
      set({ selectedMedia: [...selectedMedia, media] })
    }
  },

  removeMedia: (id) => {
    const { selectedMedia } = get()
    set({ selectedMedia: selectedMedia.filter((m) => m.id !== id) })
  },

  toggleMedia: (media) => {
    const { selectedMedia } = get()
    const isSelected = selectedMedia.some((m) => m.id === media.id)

    if (isSelected) {
      set({ selectedMedia: selectedMedia.filter((m) => m.id !== media.id) })
    } else if (selectedMedia.length < 10) {
      set({ selectedMedia: [...selectedMedia, media] })
    }
  },

  setCaption: (caption) => set({ caption }),
  setLocation: (location) => set({ location }),
  setLocationData: (data) => set({ locationData: data, location: data?.name || "" }),
  setTaggedPeople: (people) => set({ taggedPeople: people }),
  setIsNSFW: (isNSFW) => set({ isNSFW }),
  setStep: (step) => set({ step }),
  startUpload: () => set({ isUploading: true, uploadProgress: 0 }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  finishUpload: () => set({ isUploading: false, uploadProgress: 100 }),
  reset: () => set(initialState),
}))
