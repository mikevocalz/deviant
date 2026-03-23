import { create } from "zustand";

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isPlaying: boolean;
  isFullscreen: boolean;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentTime: 0,
  duration: 0,
  isMuted: false,
  isPlaying: true,
  isFullscreen: false,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
  reset: () => set(initialState),
}));
