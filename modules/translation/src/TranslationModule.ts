import { requireNativeModule } from 'expo-modules-core';
import { TranslationResult } from './Translation.types';

interface TranslationModuleType {
  translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<TranslationResult>;
  isTranslationAvailable(
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<boolean>;
  downloadLanguagePack(language: string): Promise<void>;
  getAvailableLanguages(): Promise<string[]>;
}

export default requireNativeModule<TranslationModuleType>('Translation');
