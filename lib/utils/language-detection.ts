/**
 * Language detection utility for translation feature
 * Detects if text is in a different language than the user's selected language
 */

import { supportedLanguages } from "@/lib/i18n";

// Common language patterns for detection
const languagePatterns: Record<string, RegExp> = {
  es: /[áéíóúüñ¿¡]|\b(el|la|los|las|un|una|y|o|pero|porque|cuando|donde|quien|que|como|este|esta|estos|estas|ese|esa|esos|esas|mi|tu|su|nuestro|vuestro|sus|mis|tus|para|por|con|sin|sobre|bajo|entre|hasta|desde|durante|mediante|según|contra|hacia|hasta|después|antes|mientras|tan|tanto|muy|mucho|poco|más|menos|bien|mal|ahora|antes|después|luego|pronto|tarde|temprano|ya|aún|todavía|siempre|nunca|jamás|también|tampoco|sí|no)\b/gi,
  fr: /[àâäæçéèêëîïôœùûüÿ]|\b(le|la|les|un|une|des|et|ou|mais|parce que|quand|où|qui|que|comment|ce|cette|ces|cet|mon|ton|son|notre|votre|leur|mes|tes|ses|nos|vos|leurs|pour|par|avec|sans|sur|sous|entre|jusque|depuis|pendant|durant|selon|contre|vers|après|avant|tandis|si|aussi|beaucoup|peu|plus|moins|bien|mal|maintenant|avant|après|puis|bientôt|tard|tôt|déjà|encore|toujours|jamais|aussi|non|oui)\b/gi,
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/, // Hiragana, Katakana, Kanji
  zh: /[\u4E00-\u9FFF]/, // Chinese characters
  de: /[äöüß]|\b(der|die|das|ein|eine|und|oder|aber|weil|wenn|wo|wer|was|wie|dieser|diese|dieses|jener|jene|mein|dein|sein|unser|euer|ihr|für|durch|mit|ohne|über|unter|zwischen|bis|seit|während|nach|vor|während|so|auch|viel|wenig|mehr|weniger|gut|schlecht|jetzt|vorher|nachher|dann|bald|spät|früh|schon|noch|immer|nie|auch|ja|nein)\b/gi,
  it: /[àèéìòù]|\b(il|la|lo|i|gli|le|un|uno|una|e|o|ma|perché|quando|dove|chi|che|come|questo|questa|questi|queste|codesto|codesta|mio|tuo|suo|nostro|vostro|loro|per|con|senza|su|sotto|tra|fino|da|durante|secondo|contro|verso|dopo|prima|mentre|così|tanto|molto|poco|più|meno|bene|male|ora|prima|dopo|poi|presto|tardi|presto|già|ancora|sempre|mai|anche|sì|no)\b/gi,
};

/**
 * Detect if text is likely in a different language than the target language
 * Returns the detected language code or null if it appears to be English/default
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 3) return null;

  const normalizedText = text.toLowerCase().trim();

  // Check each language pattern
  for (const [langCode, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(normalizedText)) {
      return langCode;
    }
  }

  // If no specific patterns matched, assume English/default
  return null;
}

/**
 * Check if text should be translatable based on user's language preference
 * Returns true if text appears to be in a different language
 */
export function shouldShowTranslateButton(
  text: string,
  userLanguage: string,
): boolean {
  if (!text || text.trim().length < 3) return false;

  // Don't show translate if user is already viewing in that language
  const detectedLang = detectLanguage(text);

  // If no language detected (assumed English) and user is English, don't show
  if (!detectedLang && userLanguage === "en") return false;

  // If detected language matches user's language, don't show
  if (detectedLang === userLanguage) return false;

  // Show translate button - text appears to be in a different language
  return true;
}

/**
 * Get display name for a language code
 */
export function getLanguageDisplayName(langCode: string): string {
  const names: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    ja: "Japanese",
    zh: "Chinese",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ko: "Korean",
    ar: "Arabic",
  };
  return names[langCode] || langCode.toUpperCase();
}
