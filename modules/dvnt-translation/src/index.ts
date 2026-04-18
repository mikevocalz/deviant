import DVNTTranslationModule from "./TranslationModule";

export { TranslationResult } from "./Translation.types";

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{ translatedText: string; detectedSourceLanguage: string }> {
  if (!DVNTTranslationModule) {
    throw new Error("DVNTTranslation is not available in this build");
  }
  return await DVNTTranslationModule.translateText(text, sourceLanguage, targetLanguage);
}

export async function isTranslationAvailable(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<boolean> {
  if (!DVNTTranslationModule) return false;
  return await DVNTTranslationModule.isTranslationAvailable(sourceLanguage, targetLanguage);
}

export async function detectLanguage(text: string): Promise<string> {
  if (!DVNTTranslationModule) return "und";
  return await DVNTTranslationModule.detectLanguage(text);
}

export async function downloadLanguagePack(language: string): Promise<void> {
  if (!DVNTTranslationModule) return;
  return await DVNTTranslationModule.downloadLanguagePack(language);
}

export async function getAvailableLanguages(): Promise<string[]> {
  if (!DVNTTranslationModule) return [];
  return await DVNTTranslationModule.getAvailableLanguages();
}
