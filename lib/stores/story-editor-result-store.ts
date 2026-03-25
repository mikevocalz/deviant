import { create } from "zustand";

interface StoryEditorResult {
  uri: string;
  index: number;
}

interface StoryEditorResultState {
  result: StoryEditorResult | null;
  setResult: (result: StoryEditorResult) => void;
  consumeResult: () => StoryEditorResult | null;
  clear: () => void;
}

export const useStoryEditorResultStore = create<StoryEditorResultState>(
  (set, get) => ({
    result: null,
    setResult: (result) => set({ result }),
    consumeResult: () => {
      const result = get().result;
      set({ result: null });
      return result;
    },
    clear: () => set({ result: null }),
  }),
);
