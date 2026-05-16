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

// Boot-time language MUST be derivable WITHOUT calling expo-localization.
// On iOS 26 the synchronous ExpoModulesJSI bridge for `getLocales()` crashes
// inside JavaScriptRuntime.createArray during early Hermes init — confirmed
// via 9+ on-device crashes on iPhone 14 Pro. The detected system locale is
// applied LATER from applySystemLocaleAfterBoot() once the JS bridge is
// settled (call it from a useEffect at the root of the protected layout).
const getBootLanguage = (): string => {
  const stored = mmkv.getString(LANGUAGE_STORAGE_KEY);
  if (stored && resources[stored as keyof typeof resources]) {
    return stored;
  }
  // No stored preference yet — use English at boot. The post-boot async
  // detector will swap to the system locale on the next tick if it's
  // supported. Users who change language explicitly hit changeLanguage()
  // which persists, so this default only ever shows on first launch.
  return "en";
};

/**
 * Asynchronously detect the system locale and update i18n if it differs
 * from the current language and there is no stored user preference yet.
 *
 * Safe to call from a useEffect at the root layout. Uses a dynamic import
 * of expo-localization so the module isn't loaded during initial Hermes
 * boot — that's what triggered the iOS 26 createArray SIGSEGV.
 */
export async function applySystemLocaleAfterBoot(): Promise<void> {
  if (mmkv.getString(LANGUAGE_STORAGE_KEY)) return;
  try {
    const { getLocales } = await import("expo-localization");
    const locales = getLocales();
    const systemLang = locales?.[0]?.languageCode ?? "en";
    if (
      systemLang &&
      systemLang !== i18n.language &&
      resources[systemLang as keyof typeof resources]
    ) {
      await i18n.changeLanguage(systemLang);
    }
  } catch (err) {
    // Non-fatal — keep the boot default if locale detection fails.
    console.warn("[i18n] applySystemLocaleAfterBoot failed:", err);
  }
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
