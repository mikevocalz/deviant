import { create } from "zustand";
import { mmkv } from "@/lib/mmkv-zustand";

interface TranslationCacheEntry {
  text: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface TranslationState {
  // Cache: contentHash -> translated text
  cache: Map<string, string>;
  // Track which content IDs are currently showing translation
  activeTranslations: Set<string>;
  // Loading states
  loadingContentIds: Set<string>;

  // Actions
  getCachedTranslation: (contentHash: string) => string | undefined;
  setTranslation: (contentHash: string, translatedText: string) => void;
  isTranslated: (contentId: string) => boolean;
  toggleTranslation: (contentId: string) => void;
  setLoading: (contentId: string, loading: boolean) => void;
  isLoading: (contentId: string) => boolean;
  clearCache: () => void;
}

const CACHE_PREFIX = "translation_cache_";
const MAX_CACHE_ENTRIES = 500;

// Generate content hash for cache key
function hashContent(
  text: string,
  sourceLang: string,
  targetLang: string,
): string {
  // Simple hash for demo - in production use a proper hash function
  const str = `${text}:${sourceLang}:${targetLang}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `${CACHE_PREFIX}${Math.abs(hash)}`;
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  cache: new Map(),
  activeTranslations: new Set(),
  loadingContentIds: new Set(),

  getCachedTranslation: (contentHash: string) => {
    // Check memory cache first
    const memCached = get().cache.get(contentHash);
    if (memCached) return memCached;

    // Check MMKV
    const stored = mmkv.getString(contentHash);
    if (stored) {
      // Populate memory cache
      get().cache.set(contentHash, stored);
      return stored;
    }

    return undefined;
  },

  setTranslation: (contentHash: string, translatedText: string) => {
    // Update memory cache
    const newCache = new Map(get().cache);
    newCache.set(contentHash, translatedText);

    // Evict old entries if needed
    if (newCache.size > MAX_CACHE_ENTRIES) {
      const iterator = newCache.keys();
      const firstResult = iterator.next();
      if (!firstResult.done && firstResult.value) {
        newCache.delete(firstResult.value);
      }
    }

    set({ cache: newCache });

    // Persist to MMKV
    mmkv.set(contentHash, translatedText);
  },

  isTranslated: (contentId: string) => {
    return get().activeTranslations.has(contentId);
  },

  toggleTranslation: (contentId: string) => {
    const newSet = new Set(get().activeTranslations);
    if (newSet.has(contentId)) {
      newSet.delete(contentId);
    } else {
      newSet.add(contentId);
    }
    set({ activeTranslations: newSet });
  },

  setLoading: (contentId: string, loading: boolean) => {
    const newSet = new Set(get().loadingContentIds);
    if (loading) {
      newSet.add(contentId);
    } else {
      newSet.delete(contentId);
    }
    set({ loadingContentIds: newSet });
  },

  isLoading: (contentId: string) => {
    return get().loadingContentIds.has(contentId);
  },

  clearCache: () => {
    set({ cache: new Map(), activeTranslations: new Set() });
    // Clear MMKV cache entries
    const keys = mmkv.getAllKeys().filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => mmkv.remove(k));
  },
}));

// Helper hook for content translation
export function useContentTranslation(
  contentId: string,
  originalText: string,
  targetLang: string,
) {
  const store = useTranslationStore();
  const contentHash = hashContent(originalText, "auto", targetLang);

  const isTranslated = store.isTranslated(contentId);
  const isLoading = store.isLoading(contentId);
  const cachedTranslation = store.getCachedTranslation(contentHash);

  const translate = async () => {
    if (cachedTranslation) {
      store.toggleTranslation(contentId);
      return cachedTranslation;
    }

    store.setLoading(contentId, true);
    try {
      const translated = await translateText(originalText, targetLang);
      store.setTranslation(contentHash, translated);
      store.toggleTranslation(contentId);
      return translated;
    } catch (err) {
      // Do NOT cache or toggle on failure — surface the error to the UI
      throw err;
    } finally {
      store.setLoading(contentId, false);
    }
  };

  const showOriginal = () => {
    store.toggleTranslation(contentId);
  };

  const displayText = isTranslated
    ? (cachedTranslation ?? originalText)
    : originalText;

  return {
    displayText,
    isTranslated,
    isLoading,
    translate,
    showOriginal,
    hasTranslation: !!cachedTranslation,
  };
}

// Native translation function using the expo module.
// Throws on failure so callers can surface errors to the UI.
async function translateText(
  text: string,
  targetLang: string,
): Promise<string> {
  let nativeTranslate: ((text: string, src: string, tgt: string) => Promise<{ translatedText: string }>) | null = null;
  try {
    const mod = await import("@/modules/translation/src");
    nativeTranslate = mod.translateText;
  } catch {
    throw new Error("Translation is not available in this build");
  }
  const result = await nativeTranslate(text, "auto", targetLang);
  if (!result?.translatedText) {
    throw new Error("Translation returned an empty result");
  }
  return result.translatedText;
}
