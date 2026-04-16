import TranslationModule from "./TranslationModule";
import { TranslationResult } from "./Translation.types";

export { TranslationResult } from "./Translation.types";

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  if (!TranslationModule) {
    throw new Error("Translation is not available in this build");
  }
  return await TranslationModule.translateText(
    text,
    sourceLanguage,
    targetLanguage,
  );
}

export async function isTranslationAvailable(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<boolean> {
  if (!TranslationModule) return false;
  return await TranslationModule.isTranslationAvailable(
    sourceLanguage,
    targetLanguage,
  );
}

export async function downloadLanguagePack(language: string): Promise<void> {
  if (!TranslationModule) return;
  return await TranslationModule.downloadLanguagePack(language);
}

export async function getAvailableLanguages(): Promise<string[]> {
  if (!TranslationModule) return [];
  return await TranslationModule.getAvailableLanguages();
}
