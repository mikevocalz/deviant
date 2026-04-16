import TranslationModule from "./TranslationModule";
import { TranslationResult } from "./Translation.types";

export { TranslationResult } from "./Translation.types";

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
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
  return await TranslationModule.isTranslationAvailable(
    sourceLanguage,
    targetLanguage,
  );
}

export async function downloadLanguagePack(language: string): Promise<void> {
  return await TranslationModule.downloadLanguagePack(language);
}

export async function getAvailableLanguages(): Promise<string[]> {
  return await TranslationModule.getAvailableLanguages();
}
