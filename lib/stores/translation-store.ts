import { create } from "zustand";
import { mmkv } from "@/lib/mmkv-zustand";
import { useState, useEffect } from "react";
import DVNTTranslationModule from "@/modules/dvnt-translation/src/TranslationModule";
import { translateText as nativeTranslate } from "@/modules/dvnt-translation/src";

// ── Capability probe — checked once per app session ───────────────────────────
//
// Uses TranslationModule.isTranslationAvailable as the capability signal:
//   • 1.0.213 stub   : throws          → caught → false → button hidden
//   • 1.0.214 iOS 17.4+ : true/false   → surface translate button accordingly
//   • 1.0.214 iOS <17.4 : false        → button hidden (graceful)
//   • module null    : false            → button hidden

let _capabilityPromise: Promise<boolean> | null = null;

function checkNativeCapability(): Promise<boolean> {
  if (_capabilityPromise) return _capabilityPromise;
  _capabilityPromise = (async () => {
    if (!DVNTTranslationModule) return false;
    try {
      return await DVNTTranslationModule.isTranslationAvailable("en", "es");
    } catch {
      return false;
    }
  })();
  return _capabilityPromise;
}

// ── Store ─────────────────────────────────────────────────────────────────────

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

function hashContent(
  text: string,
  sourceLang: string,
  targetLang: string,
): string {
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
    const memCached = get().cache.get(contentHash);
    if (memCached) return memCached;

    const stored = mmkv.getString(contentHash);
    if (stored) {
      get().cache.set(contentHash, stored);
      return stored;
    }
    return undefined;
  },

  setTranslation: (contentHash: string, translatedText: string) => {
    const newCache = new Map(get().cache);
    newCache.set(contentHash, translatedText);

    if (newCache.size > MAX_CACHE_ENTRIES) {
      const iterator = newCache.keys();
      const firstResult = iterator.next();
      if (!firstResult.done && firstResult.value) {
        newCache.delete(firstResult.value);
      }
    }

    set({ cache: newCache });
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
    const keys = mmkv.getAllKeys().filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => mmkv.remove(k));
  },
}));

// ── useContentTranslation — per-content translation hook ─────────────────────
//
// Returns `isCapable: boolean | null`:
//   null  = still checking (hide button)
//   false = native translation unavailable (hide button)
//   true  = native translation available (show button if text is foreign)

export function useContentTranslation(
  contentId: string,
  originalText: string,
  targetLang: string,
) {
  const store = useTranslationStore();
  const contentHash = hashContent(originalText, "auto", targetLang);

  // Capability: null=checking, false=unavailable, true=available
  const [isCapable, setIsCapable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkNativeCapability().then((capable) => {
      if (!cancelled) setIsCapable(capable);
    });
    return () => { cancelled = true; };
  }, []);

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
    isCapable,
    translate,
    showOriginal,
    hasTranslation: !!cachedTranslation,
  };
}

// ── On-device translation — Apple Translation (iOS) / ML Kit (Android) ────────
// Throws on failure so callers can surface errors to the UI.

async function translateText(text: string, targetLang: string): Promise<string> {
  const tgt = (!targetLang || targetLang === "auto"
    ? "en"
    : targetLang.split("-")[0]
  ).toLowerCase();

  // Try native Apple Translation first
  try {
    const result = await nativeTranslate(text, "auto", tgt);
    return result.translatedText;
  } catch {
    // Native failed (language packs not downloaded, iOS < 18, etc.)
    // Fall back to MyMemory free translation API
  }

  const encoded = encodeURIComponent(text);
  const resp = await fetch(
    `https://api.mymemory.translated.net/get?q=${encoded}&langpair=auto|${tgt}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!resp.ok) throw new Error(`Translation service unavailable (${resp.status})`);
  const data = await resp.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  throw new Error(data.responseDetails || "Translation failed");
}
