import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { mmkv } from "@/lib/mmkv-zustand";

import en from "./translations/en.json";
import es from "./translations/es.json";
import fr from "./translations/fr.json";
import ja from "./translations/ja.json";
import pt from "./translations/pt.json";
import zh from "./translations/zh.json";

const LANGUAGE_STORAGE_KEY = "app_language_preference";

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ja: { translation: ja },
  pt: { translation: pt },
  zh: { translation: zh },
};

// Hermes-only Intl detector. NO expo-localization bridge call — that
// crashes ExpoModulesJSI on iOS 26 in both boot and useEffect paths.
// Intl.DateTimeFormat resolves to whatever locale Hermes was init'd
// with, which is the device locale, and it's a pure-JS call that never
// touches the JSI bridge.
function detectSystemLanguage(): string {
  try {
    const tag = new Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const code = tag.toLowerCase().split(/[-_]/)[0];
    return code || "en";
  } catch {
    return "en";
  }
}

const getBootLanguage = (): string => {
  const stored = mmkv.getString(LANGUAGE_STORAGE_KEY);
  if (stored && resources[stored as keyof typeof resources]) {
    return stored;
  }
  const sys = detectSystemLanguage();
  if (resources[sys as keyof typeof resources]) return sys;
  return "en";
};

/**
 * No-op kept for backwards-compatibility with callers that imported the
 * old async detector. Locale is now resolved synchronously at boot from
 * `Intl`, so there's nothing left to do post-mount.
 */
export async function applySystemLocaleAfterBoot(): Promise<void> {
  // intentionally empty
}

export const supportedLanguages = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "pt", name: "Portuguese (Brazil)", native: "Português (Brasil)" },
  { code: "zh", name: "Chinese", native: "中文" },
];

export const changeLanguage = (lang: string) => {
  if (resources[lang as keyof typeof resources]) {
    i18n.changeLanguage(lang);
    mmkv.set(LANGUAGE_STORAGE_KEY, lang);
    return true;
  }
  return false;
};

export const getCurrentLanguage = () => i18n.language;

i18n.use(initReactI18next).init({
  resources,
  lng: getBootLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
